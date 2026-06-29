# Ticketing

Sistema web full-stack para gestion de eventos, usuarios, butacas, reservas y pagos. El proyecto combina una API REST desarrollada con ASP.NET Core y C# con un frontend en HTML, CSS y JavaScript.

## Objetivo del sistema

El objetivo es simular una plataforma de ticketing donde distintos tipos de usuarios puedan consultar eventos, seleccionar butacas, gestionar reservas, registrar pagos y administrar informacion operativa del sistema.

Este repositorio esta orientado a mostrar capacidades de backend, modelado de datos, APIs REST, separacion por capas y consumo desde frontend.

## Tecnologias utilizadas

- ASP.NET Core 8
- C#
- Entity Framework Core
- Pomelo Entity Framework Core MySQL
- MySQL
- Swagger / OpenAPI
- HTML
- CSS
- JavaScript
- Git y GitHub

## Funcionalidades principales

- Autenticacion de usuarios.
- Gestion de eventos.
- Gestion de usuarios y roles.
- Gestion de sectores y butacas.
- Reserva de butacas.
- Expiracion de reservas mediante servicio en segundo plano.
- Registro y consulta de pagos.
- Panel de gestion para administracion.
- Frontend web para navegacion, seleccion de butacas, carrito y pagos.

## Arquitectura

El proyecto sigue una arquitectura por capas:

```text
Cliente
  -> Frontend HTML/CSS/JavaScript
  -> API REST ASP.NET Core
  -> Controllers
  -> Services
  -> Entity Framework Core
  -> MySQL
```

### Backend

Ubicacion principal:

```text
backend/data/Ticket/Ticket/
```

Estructura relevante:

```text
Controllers/   Endpoints REST para auth, eventos, pagos, reservas y usuarios.
Services/      Logica de negocio para reservas, pagos, expiracion y hashing.
Models/        Entidades del dominio: usuarios, eventos, reservas, butacas, pagos.
DTOs/          Objetos de transferencia para requests y responses.
Data/          DbContext, migraciones y seeding inicial.
Middleware/    Middleware para versionado de API por header.
```

### Frontend

Ubicacion principal:

```text
frontend/
```

Incluye pantallas HTML, estilos CSS y logica JavaScript para consumir la API, manejar autenticacion, seleccionar butacas, administrar eventos y simular pagos.

## Como ejecutar el proyecto localmente

### Requisitos

- .NET SDK 8
- MySQL Server
- Visual Studio, Rider o VS Code
- Navegador web

### Backend

1. Crear una base de datos MySQL local.
2. Revisar la cadena de conexion en:

```text
backend/data/Ticket/Ticket/appsettings.json
```

Ejemplo local:

```json
"ConnectionStrings": {
  "DefaultConnection": "server=localhost;port=3306;database=Ticketdb;user=YOUR_DB_USER;password=YOUR_DB_PASSWORD;"
}
```

3. Ejecutar la API:

```bash
cd backend/data/Ticket/Ticket
dotnet restore
dotnet run
```

4. En entorno de desarrollo, Swagger queda disponible desde la URL indicada por la consola.

### Frontend

Abrir los archivos HTML dentro de `frontend/` o servir la carpeta con una extension como Live Server.

## Capturas

Pendiente agregar capturas del sistema:

- Home / listado de eventos.
- Login.
- Seleccion de butacas.
- Carrito o pago.
- Panel de administracion.

Guardar las imagenes sugeridas en:

```text
docs/screenshots/
```

## Estado del proyecto

Proyecto academico en desarrollo, con foco en backend, API REST, persistencia en MySQL y consumo desde frontend.

## Aprendizajes tecnicos

- Diseno de API REST con ASP.NET Core.
- Separacion entre controllers, services, models y DTOs.
- Persistencia con Entity Framework Core y MySQL.
- Modelado de entidades relacionadas.
- Manejo de reservas y estados.
- Consumo de endpoints desde JavaScript.
- Organizacion de un proyecto full-stack.

## Mejoras futuras

- Agregar autenticacion con JWT.
- Mover configuraciones sensibles a variables de entorno o secretos de usuario.
- Agregar tests unitarios y de integracion.
- Mejorar validaciones del frontend.
- Agregar capturas y demo desplegada.
- Documentar endpoints principales con ejemplos de request/response.

## Nota de seguridad

Las credenciales y usuarios de prueba deben considerarse datos demo. Para un entorno real, cambiar passwords, restringir CORS, usar variables de entorno y no publicar cadenas de conexion productivas.
