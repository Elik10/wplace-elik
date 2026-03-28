# Гайд налаштування/встановлення openplace — Docker

Цей гайд допоможе вас налаштувати **openplace** на докер.

## Prerequisites

Вам потрібно встановлені **Docker** та **Docker Compose** на вашій системі.

### Install Docker

-   **Windows**: Встановити Docker Desktop звідци [docker.com](https://www.docker.com/products/docker-desktop/)
-   **macOS**: Встановити Docker Desktop звідци [docker.com](https://www.docker.com/products/docker-desktop/)
-   **Linux**: Слідуйте за гайдом по встановлення Docker на ваш дистрибутив тут [docs.docker.com](https://docs.docker.com/engine/install/)

## 1. Клонувати репозиторій

```bash
git clone --recurse-submodules https://github.com/openplaceteam/openplace
cd openplace
```

## 2. Налаштування середовища

1. Скопіюйте `.env.example` та переменуйте на `.env`:

```bash
cp .env.example .env
```

2. Змініть `.env` файл та конфігуруйте налаштування:
    - Змініть значення вашого `JWT_SECRET` (згенеруйте рандомну строку для безпеки)
    - Змініть значення вашого `DATABASE_URL` на `"mysql://root:password@db/openplace"`
    - пароль юзера root у MariaDB встановлений за замовчуванням  `password` (змініть, якщо це потрібно)

> [Попередження ⚠️]
> Екрануйте спеціальні символи, наведені в цій таблиці: [Percent-Encoding](https://developer.mozilla.org/en-US/docs/Glossary/Percent-encoding)

## 3. Запустити застосунок

Запустіть всі сервіси через Docker Compose:

```bash
docker-compose up -d
```

Після цього буду запущені наступне:

-   **MariaDB database** на порті 3306
-   **Node.js application** (бекенд)
-   **Caddy reverse proxy** на порті 443

## 4. Доступ до застосунку

Коли всі сервісі запустилися та працюють - ви зможете получити доступ до openplace за такими посиланнями:

```
http://localhost
https://localhost
```
