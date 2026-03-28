# openplace — Гайд з налаштування Windows

Цей гайд допоможе вам підготувати ваш девайс з **Windows** до запуску **openplace**.

---

## 1. Встановіть необхідні компоненти

Вам потрібні **Node.js**, **Git**, **MariaDB**, **Caddy**.

- Використання **winget** (Windows 10/11, запустіть PowerShell від імені адміністратора):

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install CaddyServer.Caddy
winget install nssm
```

- Використання **Chocolatey** (cmd від імені адміністратора):

```cmd
choco install git nodejs-lts caddy nssm -y
```

- Завантажте MariaDB Server за цим посиланням: [MariaDB Server](https://mirror.mva-n.net/mariadb///mariadb-12.0.2/winx64-packages/mariadb-12.0.2-winx64.msi)
- Запустіть інсталятор
- Встановіть пароль root і залиште всі налаштування за замовчуванням

---

## 2. Клонувати репозиторій

```powershell
git clone --recurse-submodules https://github.com/openplaceteam/openplace
cd openplace
```

---

## 3. Встановіть залежності Node

```powershell
npm install
npm install -g pm2
```

---

## 4. Зупиніть служби Caddy (необхідно, якщо Caddy встановлено як службу)

- Якщо Caddy встановлено як службу, зупиніть його за допомогою **Services.msc**  
- Або вручну:

```powershell
net stop caddy
```

---

## 5. Налаштування та створення бази даних

1. Скопіюйте `.env.example` та переменуйте на `.env`:

```powershell
Copy-Item .env.example .env
```

Відредагуйте `.env` і замініть `root:password` на ваш пароль root MariaDB та змініть `JWT_SECRET`.

> [ПОПЕРЕДЖЕННЯ ⚠️]
> Екрануйте спеціальні символи, наведені в цій таблиці: [Percent-Encoding](https://developer.mozilla.org/en-US/docs/Glossary/Percent-encoding)

---

## 6. Налаштування Prisma та бази даних

```powershell
npm run db:generate
npm run setup
```

---

## 7.A Запустіть кожен сервер окремо

запустіть frontend в одному терміналі: 
```powershell
npm run dev
```
запустіть caddy в другому терміналі:
```powershell
caddy run --config .\Caddyfile
```

---

## 7.B Запустіть обидва в одному терміналі

```cmd
npm run exec
```

## 7.C Запустіть Caddy у фоновому режимі, а node — у фоновому

```
pm2 start ecosystem.config.cjs
pm2 save
```


---

## Запуск сервера

- Для публіки/продакшн налаштуйте SSL-сертифікат.  
- Для локального/приватного використання перейдіть за адресою:

```
https://{your-local-IP}:8080
```

> [ПОПЕРЕДЖЕННЯ ⚠️]
> ⚠️ **Важливо:** OpenPlace працює тільки через HTTPS. Якщо ви спробуєте HTTP, ви отримаєте **400 Bad Request**.


---

## Оновлення бази даних

Якщо схема бази даних змінюється, запустіть:

```powershell
npm run db:push
```
