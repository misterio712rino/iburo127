output "vm_id" {
  description = "Staging scanner VM ID."
  value       = yandex_compute_instance.scanner.id
}

output "vm_internal_ip" {
  description = "Private IPv4 address assigned inside the reviewed staging subnet."
  value       = yandex_compute_instance.scanner.network_interface[0].ip_address
}

output "static_public_ip" {
  description = "Reserved public IPv4 for the staging scanner TLS endpoint."
  value       = yandex_vpc_address.scanner.external_ipv4_address[0].address
}

output "security_group_id" {
  description = "Dedicated staging scanner security-group ID."
  value       = yandex_vpc_security_group.scanner.id
}

output "scanner_subnet_id" {
  description = "Dedicated staging scanner subnet ID."
  value       = yandex_vpc_subnet.scanner.id
}

output "scanner_subnet_cidr" {
  description = "Dedicated staging scanner subnet IPv4 CIDR."
  value       = var.subnet_cidr
}

output "scanner_hostname" {
  description = "Non-secret staging hostname when supplied; null until separately assigned."
  value       = var.scanner_hostname == "" ? null : var.scanner_hostname
}
