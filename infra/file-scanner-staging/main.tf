locals {
  labels = {
    environment = "staging"
    service     = "file-scanner"
    repository  = "iburo127"
  }

  resolved_image_id = var.image_id != "" ? var.image_id : data.yandex_compute_image.ubuntu_2404[0].id
  ssh_enabled       = var.allow_operator_ssh && var.operator_ssh_cidr != "" && var.ssh_public_key != ""
}

data "yandex_compute_image" "ubuntu_2404" {
  count     = var.image_id == "" ? 1 : 0
  family    = "ubuntu-2404-lts"
  folder_id = "standard-images"
}

data "yandex_vpc_subnet" "staging" {
  subnet_id = var.subnet_id
}

resource "yandex_vpc_security_group" "scanner" {
  name        = var.security_group_name
  description = "Dedicated ingress and bounded protocol egress for the staging file scanner"
  folder_id   = var.folder_id
  network_id  = var.network_id
  labels      = local.labels

  ingress {
    description    = "Public HTTPS to Caddy"
    protocol       = "TCP"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 443
  }

  ingress {
    description    = "HTTP only for Caddy ACME and HTTPS redirect"
    protocol       = "TCP"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 80
  }

  dynamic "ingress" {
    for_each = local.ssh_enabled ? [var.operator_ssh_cidr] : []
    content {
      description    = "Temporary operator SSH from an explicit IPv4 /32"
      protocol       = "TCP"
      v4_cidr_blocks = [ingress.value]
      port           = 22
    }
  }

  egress {
    description    = "HTTPS for private blob reads, signature updates, ACME, and registry pulls"
    protocol       = "TCP"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 443
  }

  egress {
    description    = "DNS over UDP; the guest OS remains configured for the reviewed VPC resolver"
    protocol       = "UDP"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 53
  }

  egress {
    description    = "DNS over TCP for truncated responses"
    protocol       = "TCP"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 53
  }

  egress {
    description    = "NTP required for TLS and signature-freshness decisions"
    protocol       = "UDP"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 123
  }

  lifecycle {
    precondition {
      condition     = data.yandex_vpc_subnet.staging.network_id == var.network_id
      error_message = "subnet_id must belong to the reviewed staging network_id."
    }

    precondition {
      condition     = data.yandex_vpc_subnet.staging.zone == var.zone
      error_message = "subnet_id must be in the same zone as the VM and static address."
    }

    precondition {
      condition = (
        (var.allow_operator_ssh && local.ssh_enabled) ||
        (!var.allow_operator_ssh && var.operator_ssh_cidr == "")
      )
      error_message = "SSH requires both an explicit operator /32 and a public key; the CIDR must stay empty when SSH is disabled."
    }
  }
}

resource "yandex_vpc_address" "scanner" {
  name                = var.public_ip_name
  description         = "Static public IPv4 reserved only for the staging file scanner"
  folder_id           = var.folder_id
  deletion_protection = true
  labels              = local.labels

  external_ipv4_address {
    zone_id = var.zone
  }
}

resource "yandex_compute_instance" "scanner" {
  name                      = var.vm_name
  hostname                  = var.vm_name
  description               = "Isolated staging malware scanner; never use for production"
  folder_id                 = var.folder_id
  zone                      = var.zone
  platform_id               = var.platform_id
  allow_stopping_for_update = false
  labels                    = local.labels

  resources {
    cores         = var.cores
    core_fraction = var.core_fraction
    memory        = var.memory_gb
  }

  scheduling_policy {
    preemptible = false
  }

  boot_disk {
    auto_delete = true
    initialize_params {
      image_id = local.resolved_image_id
      name     = "${var.vm_name}-boot"
      size     = var.boot_disk_size_gb
      type     = var.boot_disk_type
    }
  }

  network_interface {
    subnet_id          = var.subnet_id
    nat                = true
    nat_ip_address     = yandex_vpc_address.scanner.external_ipv4_address[0].address
    security_group_ids = [yandex_vpc_security_group.scanner.id]
  }

  metadata = merge(
    {
      "serial-port-enable" = "0"
      "user-data" = templatefile("${path.module}/cloud-init.yaml.tftpl", {
        scanner_image        = var.scanner_image
        scanner_image_digest = var.scanner_image_digest
      })
    },
    local.ssh_enabled ? {
      "ssh-keys" = "scanner-admin:${trimspace(var.ssh_public_key)}"
    } : {},
  )

  lifecycle {
    precondition {
      condition     = var.environment == "staging"
      error_message = "The scanner VM can only be created for staging."
    }

    precondition {
      condition     = !var.tls_activation_enabled || var.scanner_hostname != ""
      error_message = "A separately approved staging hostname is required before TLS activation."
    }
  }
}
