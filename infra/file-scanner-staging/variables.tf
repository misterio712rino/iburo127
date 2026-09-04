variable "cloud_id" {
  description = "Reviewed Yandex Cloud ID containing only staging resources."
  type        = string

  validation {
    condition     = length(trimspace(var.cloud_id)) >= 8 && !can(regex("[[:space:][:cntrl:]]", var.cloud_id))
    error_message = "cloud_id must be a non-empty reviewed staging cloud ID."
  }
}

variable "folder_id" {
  description = "Reviewed Yandex Cloud folder ID dedicated to staging."
  type        = string

  validation {
    condition     = length(trimspace(var.folder_id)) >= 8 && !can(regex("[[:space:][:cntrl:]]", var.folder_id))
    error_message = "folder_id must be a non-empty reviewed staging folder ID."
  }
}

variable "zone" {
  description = "Availability zone for the managed staging scanner subnet, static address, and VM."
  type        = string
  default     = "ru-central1-d"

  validation {
    condition     = contains(["ru-central1-a", "ru-central1-b", "ru-central1-d", "ru-central1-e"], var.zone)
    error_message = "zone must be one of the reviewed Yandex Cloud Compute zones."
  }
}

variable "network_id" {
  description = "Existing staging-only VPC network ID. This module never creates a network."
  type        = string

  validation {
    condition     = length(trimspace(var.network_id)) >= 8 && !can(regex("[[:space:][:cntrl:]]", var.network_id))
    error_message = "network_id must identify an existing reviewed staging network."
  }
}

variable "subnet_name" {
  description = "Dedicated staging-only scanner subnet name."
  type        = string
  default     = "iburo127-file-scanner-staging-d"

  validation {
    condition = (
      can(regex("^[a-z]([-a-z0-9]{1,61}[a-z0-9])?$", var.subnet_name)) &&
      strcontains(var.subnet_name, "staging") &&
      !strcontains(var.subnet_name, "prod")
    )
    error_message = "subnet_name must be a valid staging-only Yandex resource name."
  }
}

variable "subnet_cidr" {
  description = "Exact reviewed IPv4 /28 reserved for the managed staging scanner subnet."
  type        = string
  default     = "10.132.0.0/28"

  validation {
    condition     = var.subnet_cidr == "10.132.0.0/28"
    error_message = "subnet_cidr must remain the reviewed dedicated staging range 10.132.0.0/28."
  }
}

variable "environment" {
  description = "Safety boundary for all resources in this module."
  type        = string
  default     = "staging"

  validation {
    condition     = var.environment == "staging"
    error_message = "Only environment=staging is accepted by this module."
  }
}

variable "vm_name" {
  description = "Staging scanner VM name."
  type        = string
  default     = "iburo-file-scanner-staging"

  validation {
    condition = (
      can(regex("^[a-z]([-a-z0-9]{1,61}[a-z0-9])?$", var.vm_name)) &&
      strcontains(var.vm_name, "staging") &&
      !strcontains(var.vm_name, "prod")
    )
    error_message = "vm_name must be a valid Yandex resource name containing staging."
  }
}

variable "platform_id" {
  description = "Yandex Compute platform for the scanner VM."
  type        = string
  default     = "standard-v3"

  validation {
    condition     = contains(["standard-v2", "standard-v3", "standard-v4"], var.platform_id)
    error_message = "platform_id must be an explicitly reviewed standard Yandex Compute platform."
  }
}

variable "cores" {
  description = "VM vCPU count."
  type        = number
  default     = 2

  validation {
    condition     = floor(var.cores) == var.cores && var.cores >= 2 && var.cores <= 4
    error_message = "cores must be an integer from 2 through 4."
  }
}

variable "core_fraction" {
  description = "Guaranteed vCPU performance percentage."
  type        = number
  default     = 100

  validation {
    condition     = contains([20, 50, 100], var.core_fraction)
    error_message = "core_fraction must be one of 20, 50, or 100."
  }
}

variable "memory_gb" {
  description = "VM memory in GiB."
  type        = number
  default     = 8

  validation {
    condition     = floor(var.memory_gb) == var.memory_gb && var.memory_gb >= 4 && var.memory_gb <= 16
    error_message = "memory_gb must be an integer from 4 through 16."
  }
}

variable "boot_disk_size_gb" {
  description = "Boot disk capacity in GiB."
  type        = number
  default     = 32

  validation {
    condition     = floor(var.boot_disk_size_gb) == var.boot_disk_size_gb && var.boot_disk_size_gb >= 32 && var.boot_disk_size_gb <= 128
    error_message = "boot_disk_size_gb must be an integer from 32 through 128."
  }
}

variable "boot_disk_type" {
  description = "Replicated network disk type for the VM."
  type        = string
  default     = "network-ssd"

  validation {
    condition     = contains(["network-ssd", "network-hdd"], var.boot_disk_type)
    error_message = "boot_disk_type must be a replicated network-ssd or network-hdd disk."
  }
}

variable "image_id" {
  description = "Optional reviewed immutable OS image ID. Empty uses the official ubuntu-2404-lts family."
  type        = string
  default     = ""

  validation {
    condition     = var.image_id == "" || (length(trimspace(var.image_id)) >= 8 && !can(regex("[[:space:][:cntrl:]]", var.image_id)))
    error_message = "image_id must be empty or a reviewed Yandex Compute image ID."
  }
}

variable "public_ip_name" {
  description = "Reserved staging IPv4 resource name."
  type        = string
  default     = "iburo-file-scanner-staging-ip"

  validation {
    condition = (
      can(regex("^[a-z]([-a-z0-9]{1,61}[a-z0-9])?$", var.public_ip_name)) &&
      strcontains(var.public_ip_name, "staging") &&
      !strcontains(var.public_ip_name, "prod")
    )
    error_message = "public_ip_name must be a valid Yandex resource name containing staging."
  }
}

variable "security_group_name" {
  description = "Dedicated staging scanner security-group name."
  type        = string
  default     = "iburo-file-scanner-staging-sg"

  validation {
    condition = (
      can(regex("^[a-z]([-a-z0-9]{1,61}[a-z0-9])?$", var.security_group_name)) &&
      strcontains(var.security_group_name, "staging") &&
      !strcontains(var.security_group_name, "prod")
    )
    error_message = "security_group_name must be a valid Yandex resource name containing staging."
  }
}

variable "ssh_public_key" {
  description = "Optional operator public key. Never provide a private key. Required only when SSH ingress is enabled."
  type        = string
  default     = ""

  validation {
    condition = (
      var.ssh_public_key == "" ||
      (
        can(regex("^(ssh-ed25519|ssh-rsa) [A-Za-z0-9+/]+={0,3}( [^\r\n]+)?$", trimspace(var.ssh_public_key))) &&
        !can(regex("[\r\n]", var.ssh_public_key))
      )
    )
    error_message = "ssh_public_key must be empty or a single-line OpenSSH public key."
  }
}

variable "operator_ssh_cidr" {
  description = "Explicit operator IPv4 /32. Must stay empty while SSH ingress is disabled."
  type        = string
  default     = ""

  validation {
    condition = (
      var.operator_ssh_cidr == "" ||
      (
        can(cidrhost(var.operator_ssh_cidr, 0)) &&
        can(regex("^[0-9]{1,3}(\\.[0-9]{1,3}){3}/32$", var.operator_ssh_cidr)) &&
        var.operator_ssh_cidr != "0.0.0.0/32"
      )
    )
    error_message = "operator_ssh_cidr must be empty or an explicit non-zero IPv4 /32."
  }
}

variable "allow_operator_ssh" {
  description = "Explicit opt-in for temporary operator SSH ingress."
  type        = bool
  default     = false
}

variable "scanner_image" {
  description = "Private registry repository without a tag or digest."
  type        = string

  validation {
    condition = (
      can(regex("^[a-z0-9.-]+(:[0-9]+)?/[a-z0-9._/-]+$", var.scanner_image)) &&
      !strcontains(var.scanner_image, "@") &&
      !endswith(var.scanner_image, ":latest")
    )
    error_message = "scanner_image must be a private registry repository without a mutable tag or digest."
  }
}

variable "scanner_image_digest" {
  description = "Immutable registry digest produced from the reviewed source SHA."
  type        = string

  validation {
    condition     = can(regex("^sha256:[a-f0-9]{64}$", var.scanner_image_digest))
    error_message = "scanner_image_digest must be an immutable sha256 registry digest."
  }
}

variable "scanner_hostname" {
  description = "Future staging-only scanner hostname. Empty until DNS is separately approved."
  type        = string
  default     = ""

  validation {
    condition = (
      var.scanner_hostname == "" ||
      (
        var.scanner_hostname == lower(var.scanner_hostname) &&
        can(regex("^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$", var.scanner_hostname)) &&
        strcontains(var.scanner_hostname, "staging") &&
        !strcontains(var.scanner_hostname, "prod") &&
        var.scanner_hostname != "iburo127.ru" &&
        !endswith(var.scanner_hostname, ".iburo127.ru")
      )
    )
    error_message = "scanner_hostname must be empty or a staging FQDN outside the protected iburo127.ru domain."
  }
}

variable "tls_activation_enabled" {
  description = "Records explicit intent to activate Caddy only after a staging DNS record exists."
  type        = bool
  default     = false
}
