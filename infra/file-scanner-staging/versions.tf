terraform {
  required_version = "= 1.16.1"

  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = "= 0.223.0"
    }
  }
}
