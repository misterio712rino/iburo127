terraform {
  required_version = "= 1.16.2"

  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = "= 0.223.0"
    }
  }
}
