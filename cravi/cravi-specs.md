# cravi — Especificaciones del Proyecto

> Plataforma de pedidos en línea para negocios locales en Tampico, Tamaulipas.  
> Versión: 1.0 | Última actualización: Abril 2026

---

## Tabla de contenidos

1. [Visión del producto](#1-visión-del-producto)
2. [Arquitectura general](#2-arquitectura-general)
3. [Planes de suscripción](#3-planes-de-suscripción)
4. [App del cliente (PWA)](#4-app-del-cliente-pwa)
5. [Panel del negocio — Plan Básico](#5-panel-del-negocio--plan-básico)
6. [Panel del negocio — Plan Plus](#6-panel-del-negocio--plan-plus)
7. [Módulo de estadísticas](#7-módulo-de-estadísticas)
8. [Módulo de gestión de pedidos](#8-módulo-de-gestión-de-pedidos)
9. [Flujo completo de un pedido](#9-flujo-completo-de-un-pedido)
10. [Integraciones](#10-integraciones)
11. [Stack tecnológico](#11-stack-tecnológico)
12. [Modelo de datos](#12-modelo-de-datos)
13. [Reglas de negocio](#13-reglas-de-negocio)
14. [Roadmap](#14-roadmap)

---

## 1. Visión del producto

**cravi** es una plataforma SaaS de pedidos en línea diseñada para negocios de comida y retail local. Su propósito es conectar a clientes con negocios locales mediante una experiencia mobile-first sencilla, sin que el negocio tenga que invertir en tecnología propia.

### Propuesta de valor

| Para el cliente | Para el negocio |
|---|---|
| Descubre negocios cercanos en un solo lugar | Presencia digital sin desarrollo propio |
| Hace pedidos en segundos desde el celular | Gestión centralizada de productos y precios |
| Sigue el estado de su pedido en tiempo real | Estadísticas de ventas y comportamiento |
| Interfaz limpia, rápida, en español | Herramientas según el plan contratado |

### Alcance v1.0

- Plataforma para pedidos de comida y productos locales.
- La **entrega corre a cargo del negocio** — cravi gestiona el pedido, no la logística.
- Cobertura inicial: Tampico, Tamaulipas.
- Dos planes de suscripción para negocios: **Básico** y **Plus**.

---

## 2. Arquitectura general

```
┌─────────────────────────────────────────────────────────┐
│                    PLATAFORMA CRAVI                      │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │  App Cliente │    │ Panel Básico │    │Panel Plus │ │
│  │    (PWA)     │    │  (negocio)   │    │ (negocio) │ │
│  └──────┬───────┘    └──────┬───────┘    └─────┬─────┘ │
│         │                   │                  │        │
│         └───────────────────┴──────────────────┘        │
│                             │                           │
│                      ┌──────▼──────┐                   │
│                      │   API Core  │                   │
│                      └──────┬──────┘                   │
│                             │                           │
│         ┌───────────────────┼──────────────────┐       │
│         │                   │                  │        │
│  ┌──────▼──────┐   ┌────────▼───────┐  ┌──────▼─────┐ │
│  │  Base de    │   │  WhatsApp API  │  │ Notif.     │ │
│  │   Datos     │   │  (Plan Básico) │  │ Push/Email │ │
│  └─────────────┘   └────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Entidades principales

- **Cliente**: usuario que hace pedidos desde la PWA.
- **Negocio**: restaurante o tienda que vende sus productos en cravi.
- **Pedido**: solicitud de compra de un cliente a un negocio.
- **Producto**: artículo del catálogo de un negocio.
- **Categoría**: agrupación de productos dentro del menú/catálogo.
- **Plan**: suscripción del negocio (Básico o Plus).

---

## 3. Planes de suscripción

### Comparativa de planes

| Funcionalidad | Plan Básico | Plan Plus |
|---|:---:|:---:|
| Perfil del negocio en la app | ✅ | ✅ |
| Gestión de productos y precios | ✅ | ✅ |
| Gestión de categorías del menú | ✅ | ✅ |
| Activar / desactivar productos | ✅ | ✅ |
| Pedidos llegan por WhatsApp | ✅ | ✅ |
| Módulo de gestión de pedidos | ❌ | ✅ |
| Estados del pedido en tiempo real | ❌ | ✅ |
| Notificaciones push al cliente | ❌ | ✅ |
| Panel de estadísticas | ❌ | ✅ |
| Historial de pedidos | ❌ | ✅ |
| Reportes exportables (CSV/PDF) | ❌ | ✅ |
| Soporte prioritario | ❌ | ✅ |

### Plan Básico

- Precio sugerido: **$299 MXN/mes**
- Ideal para negocios que ya usan WhatsApp para recibir pedidos y quieren tener presencia en cravi.
- Al confirmar un pedido, el cliente recibe un resumen y el negocio recibe una **notificación por WhatsApp** con todos los detalles del pedido formateados.
- El negocio gestiona sus productos y precios desde un panel web sencillo.

### Plan Plus

- Precio sugerido: **$699 MXN/mes**
- Para negocios con mayor volumen de pedidos que necesitan gestión centralizada.
- Incluye todo el Plan Básico más el **módulo de pedidos en tiempo real** y el **panel de estadísticas**.
- El negocio puede actualizar el estado de cada pedido desde su panel (Preparando → Listo → En camino).
- El cliente ve los cambios de estado en tiempo real en la app.

---

## 4. App del cliente (PWA)

### Descripción

Aplicación web progresiva (PWA) accesible desde cualquier navegador móvil. Optimizada para instalación en pantalla de inicio en Android e iOS.

### Pantallas

#### 4.1 Onboarding
- 3 slides informativos sobre la plataforma.
- Botón "Empezar a pedir" o "Saltar".
- Se muestra solo la primera vez (se guarda en localStorage).

#### 4.2 Home
- Encabezado con ubicación del usuario (Tampico, Tamaulipas).
- Barra de búsqueda tappable (redirige a pantalla de búsqueda).
- Chips de categorías horizontales con scroll: Todo, Tacos, Pizza, Burgers, Sushi, Ramen, Postres...
- Banner destacado del negocio más popular del día.
- Lista de restaurantes filtrada por categoría seleccionada.
- FAB (botón flotante) del carrito cuando hay items agregados.

**Campos de cada tarjeta de negocio:**
- Imagen/emoji de portada con gradiente de marca.
- Nombre, calificación, número de reseñas.
- Descripción corta.
- Tiempo estimado de entrega y pedido mínimo.
- Etiqueta especial (Nuevo, Promo hoy, Top, etc.).

#### 4.3 Búsqueda
- Input de texto con búsqueda en tiempo real.
- Búsqueda por nombre de negocio, categoría o platillo específico.
- Chips de filtro rápido: categorías + filtros funcionales (Más rápido, Menor precio).
- Contador de resultados.

#### 4.4 Detalle del restaurante
- Hero con imagen/emoji y gradiente del negocio.
- Botón de regreso.
- Nombre, rating, descripción, horario, tiempo de entrega, pedido mínimo, estado (Abierto/Cerrado).
- Tabs: **Menú** / **Información**.
- En la tab Menú: secciones por categoría con items y botón de agregar.
- FAB del carrito con contador y total acumulado.

#### 4.5 Menú / Item
- Cada item muestra: emoji, nombre, descripción, precio.
- Botón `+` para agregar; una vez agregado muestra control de cantidad (− qty +).
- Los cambios de cantidad se reflejan inmediatamente en el FAB del carrito.

#### 4.6 Carrito
- Lista de items agregados con control de cantidad y botón de eliminar.
- Campo de nota para el restaurante (instrucciones especiales).
- Resumen: subtotal, cargo por servicio (5%), total.
- Botón "Ir al checkout".
- Si el carrito está vacío: estado vacío con CTA.

#### 4.7 Checkout
- Sección de datos de contacto: nombre completo, teléfono.
- Sección de dirección de entrega con aviso de que la entrega corre a cargo del negocio.
- Selector de método de pago: Tarjeta, Efectivo, Transferencia.
- Resumen colapsado del pedido (primeros 3 items + contador de adicionales).
- Total final visible.
- Botón "Confirmar pedido" con feedback de carga.
- Validación: nombre y teléfono son obligatorios.

#### 4.8 Seguimiento del pedido
- Banner superior con ETA (cuenta regresiva animada).
- Stepper vertical con estados del pedido:
  1. Pedido recibido
  2. Preparando
  3. Listo para entregar
  4. En camino
  5. Entregado
- El estado activo pulsa visualmente.
- Botón para llamar directamente al restaurante.
- Al llegar al estado "Entregado": pantalla de éxito con botón para volver al inicio.

**Nota Plan Básico:** Los estados se simulan con timer local. El negocio no actualiza estados; el seguimiento es informativo.  
**Nota Plan Plus:** Los estados son actualizados en tiempo real por el negocio desde su panel.

#### 4.9 Mis pedidos
- Historial de pedidos del usuario.
- Tarjetas con: nombre del negocio, items, total, fecha, estado.
- Tappable para ver el seguimiento de pedidos recientes.

#### 4.10 Perfil
- Datos de la cuenta: nombre, email.
- Estadísticas rápidas: número de pedidos, favoritos, direcciones guardadas.
- Opciones: Mis pedidos, Mis direcciones, Métodos de pago, Notificaciones, Ayuda.

### Navegación

- Bottom navigation bar con 4 tabs: Inicio, Buscar, Pedidos, Perfil.
- Badge con contador de items del carrito en el tab Pedidos.
- Bottom nav oculto en pantallas internas (restaurante, carrito, checkout, tracking).

### Especificaciones técnicas PWA

- **Formato:** Single HTML file (sin build step requerido para v1).
- **Framework:** React 18 + htm (tagged templates, sin Babel/JSX).
- **CDN:** jsdelivr.net para React y htm.
- **Fuente:** Plus Jakarta Sans (Google Fonts).
- **Colores:** Primary `#FF4103`, Background `#FFFBF8`, Surface `#FFFFFF`.
- **Manifest:** Incluido vía JS blob para instalación en pantalla de inicio.
- **Responsive:** Max-width 430px, centrado en desktop, fullscreen en móvil.

---

## 5. Panel del negocio — Plan Básico

### Descripción

Dashboard web sencillo para que el negocio gestione su presencia en cravi. Accesible desde cualquier navegador en desktop o móvil.

### Módulos incluidos

#### 5.1 Perfil del negocio
- Nombre del negocio.
- Descripción corta (máx. 160 caracteres).
- Categoría principal (Tacos, Pizza, Burgers, etc.).
- Número de WhatsApp para recibir pedidos.
- Horario de atención (apertura y cierre por día de la semana).
- Pedido mínimo en MXN.
- Tiempo estimado de entrega (ej. "20–35 min").
- Estado: Abierto / Cerrado (toggle manual o automático por horario).
- Imagen/emoji de portada y color de gradiente.

#### 5.2 Gestión de productos

**Categorías:**
- Crear, editar y eliminar categorías.
- Reordenar categorías con drag & drop.
- Nombre de la categoría (ej. Tacos, Quesadillas, Bebidas).

**Productos:**
- Crear, editar, eliminar productos.
- Campos por producto:
  - Nombre (requerido).
  - Descripción corta (opcional, máx. 100 caracteres).
  - Precio en MXN (requerido).
  - Emoji representativo (selector de emoji).
  - Categoría a la que pertenece.
  - Estado: Disponible / Agotado (toggle).
- Vista previa del producto tal como se ve en la app.
- Búsqueda y filtrado de productos por nombre o categoría.

#### 5.3 Notificaciones de pedido por WhatsApp

Cuando un cliente confirma un pedido, se genera un mensaje formateado automáticamente y se envía al número de WhatsApp del negocio usando la API de WhatsApp Business o el esquema `wa.me`.

**Formato del mensaje:**
```
🛍️ *Nuevo pedido en cravi*

📋 *Pedido:* #MNV4821
📅 Fecha: 16 Abr 2026, 14:32 hrs

*Cliente:*
👤 Juan Pérez
📞 834 123 4567
📍 Calle Hidalgo 420, Col. Centro

*Artículos:*
• 3x Taco al Pastor — $75 MXN
• 2x Agua de Jamaica — $40 MXN
• 1x Quesadilla de Queso — $45 MXN

💳 *Pago:* Efectivo
📝 *Nota:* Sin cebolla en los tacos

─────────────────────
💰 *Subtotal:* $160 MXN
🔧 *Cargo cravi (5%):* $8 MXN
✅ *TOTAL: $168 MXN*
─────────────────────

Powered by cravi.mx
```

- El mensaje se envía automáticamente al confirmar el pedido.
- El negocio responde directamente al cliente por WhatsApp.
- No hay seguimiento de estados en tiempo real desde cravi (plan básico).

---

## 6. Panel del negocio — Plan Plus

Incluye todo el Plan Básico más los siguientes módulos adicionales.

### 6.1 Dashboard de inicio

Al iniciar sesión, el negocio ve un resumen ejecutivo del día:

- **Métricas del día:**
  - Pedidos recibidos hoy.
  - Ventas del día (MXN).
  - Ticket promedio.
  - Pedidos pendientes.
- **Pedidos activos** (últimos 5 sin completar) con acceso rápido.
- **Alerta de agotados:** productos marcados como agotados para revisión rápida.
- **Gráfica mini:** ventas de la última semana (sparkline).

### 6.2 Gestión de pedidos en tiempo real

Panel Kanban con 5 columnas de estado:

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│  NUEVOS (🔴) │ PREPARANDO   │    LISTO     │  EN CAMINO   │  ENTREGADO   │
│              │    (🟡)      │    (🟢)      │    (🔵)      │    (✅)      │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐│
│ │#MNV4821  │ │ │#MNV4819  │ │ │#MNV4815  │ │ │#MNV4810  │ │ │#MNV4801  ││
│ │14:32 hrs │ │ │14:20 hrs │ │ │14:05 hrs │ │ │13:50 hrs │ │ │13:10 hrs ││
│ │Juan P.   │ │ │María G.  │ │ │Carlos R. │ │ │Ana S.    │ │ │Luis M.   ││
│ │$168 MXN  │ │ │$290 MXN  │ │ │$115 MXN  │ │ │$230 MXN  │ │ │$95 MXN   ││
│ │[Ver]     │ │ │[Ver]     │ │ │[Ver]     │ │ │[Ver]     │ │ │[Ver]     ││
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘│
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

#### Acciones por pedido:

**Al hacer clic en una tarjeta** se abre el detalle del pedido:
- Número de pedido, fecha y hora.
- Datos del cliente (nombre, teléfono, dirección).
- Lista completa de artículos con cantidades y precios.
- Nota del cliente.
- Método de pago.
- Total del pedido.
- Botones de acción según el estado actual:

| Estado actual | Acción disponible |
|---|---|
| Nuevo | `▶ Aceptar y empezar a preparar` / `✗ Rechazar` |
| Preparando | `✅ Marcar como listo` |
| Listo | `🛵 Marcar en camino` |
| En camino | `🏠 Marcar como entregado` |
| Entregado | Solo visualización |

#### Notificaciones:
- Alerta visual y sonora cuando llega un pedido nuevo.
- Badge con contador de pedidos nuevos en el tab/ícono del navegador.
- Notificación push al negocio (si el navegador lo permite).

#### Actualización en tiempo real al cliente:
- Cada vez que el negocio cambia el estado, el cliente ve el cambio en su pantalla de seguimiento sin necesidad de recargar.
- Se envía notificación push al cliente (si la tiene habilitada).

### 6.3 Vista de lista de pedidos

Alternativa al Kanban para negocios con alto volumen. Tabla con:
- Columnas: #Pedido, Cliente, Artículos (resumen), Total, Hora, Estado, Acciones.
- Filtros: por estado, por fecha, por rango de horas.
- Búsqueda por nombre de cliente o número de pedido.
- Paginación (20 pedidos por página).

### 6.4 Historial de pedidos

- Todos los pedidos completados y cancelados.
- Filtros por: fecha, estado, método de pago.
- Exportar a CSV o PDF.

---

## 7. Módulo de estadísticas

*Exclusivo Plan Plus.*

### 7.1 Resumen general (Overview)

Período seleccionable: Hoy / Esta semana / Este mes / Personalizado.

**KPIs principales (tarjetas de métricas):**
- Total de ventas (MXN).
- Número total de pedidos.
- Ticket promedio por pedido.
- Pedidos completados vs cancelados (%).
- Clientes únicos en el período.
- Producto más vendido.

### 7.2 Gráficas

#### Ventas en el tiempo
- Gráfica de línea/área: ventas diarias en el período.
- Comparativa con período anterior (ej. esta semana vs semana pasada).
- Eje Y: MXN, eje X: fechas.

#### Distribución de pedidos por hora
- Gráfica de barras: cantidad de pedidos agrupados por hora del día.
- Identifica los horarios pico del negocio.
- Ejemplo: mayor actividad entre 13:00 y 15:00, y 19:00 y 21:00.

#### Métodos de pago
- Gráfica de dona: distribución entre Efectivo, Tarjeta, Transferencia.

#### Pedidos por día de la semana
- Barras horizontales: lunes a domingo.
- Identifica días más activos.

### 7.3 Productos

- Tabla de los 10 productos más vendidos: nombre, unidades vendidas, ingresos generados.
- Tabla de los productos menos vendidos (últimos 30 días).
- Alerta automática: productos sin venta en los últimos 14 días.

### 7.4 Clientes

- Total de clientes únicos.
- Clientes nuevos vs recurrentes.
- Top 10 clientes por frecuencia de pedido.
- Top 10 clientes por valor total de compras.

### 7.5 Exportación de reportes

- **Reporte de ventas:** resumen del período, total por día, total general.
- **Reporte de pedidos:** listado completo con todos los campos.
- **Reporte de productos:** ranking de ventas por producto.
- Formatos disponibles: CSV y PDF.
- Filtros: por período personalizado.

---

## 8. Módulo de gestión de pedidos

*Descripción detallada — Plan Plus.*

### 8.1 Flujo de estados de un pedido

```
Cliente confirma pedido
        │
        ▼
┌───────────────┐
│    NUEVO      │  ← Notificación push + sonido en el panel del negocio
│  (pendiente)  │
└───────┬───────┘
        │ Negocio acepta (botón: "Aceptar")
        ▼
┌───────────────┐
│  PREPARANDO   │  ← Cliente ve actualización en tiempo real
│               │
└───────┬───────┘
        │ Negocio marca listo (botón: "Listo para entregar")
        ▼
┌───────────────┐
│     LISTO     │  ← Notificación push al cliente: "¡Tu pedido está listo!"
│               │
└───────┬───────┘
        │ Negocio despacha (botón: "Marcar en camino")
        ▼
┌───────────────┐
│  EN CAMINO    │  ← Notificación push al cliente: "Tu pedido viene en camino"
│               │
└───────┬───────┘
        │ Negocio confirma entrega (botón: "Entregado")
        ▼
┌───────────────┐
│  ENTREGADO ✅ │  ← Notificación push al cliente: "¡Pedido entregado!"
│               │
└───────────────┘

También puede ir a:
NUEVO → RECHAZADO ✗  (con motivo: "Sin stock", "Fuera de horario", "No podemos atenderte")
```

### 8.2 Tiempos de respuesta

- Si un pedido lleva más de **5 minutos** en estado "Nuevo" sin ser aceptado → alerta visual en el panel.
- Si un pedido lleva más de **15 minutos** sin ser aceptado → notificación por email al negocio.
- Los tiempos son configurables por el negocio.

### 8.3 Rechazo de pedidos

Al rechazar un pedido, el negocio debe seleccionar un motivo:
- Sin stock del producto solicitado.
- Fuera de horario de atención.
- Área de entrega fuera de cobertura.
- Negocio cerrado temporalmente.
- Otro (campo de texto libre).

Al rechazar, el cliente recibe notificación con el motivo.

### 8.4 Notas internas

El negocio puede agregar una nota interna a cada pedido (no visible para el cliente). Útil para anotaciones de cocina o de entrega.

---

## 9. Flujo completo de un pedido

### Plan Básico

```
1. Cliente abre cravi → Selecciona restaurante
2. Agrega productos al carrito
3. Completa checkout (nombre, teléfono, dirección, método de pago)
4. Confirma pedido → Se genera #MNV{id}
5. cravi envía mensaje de WhatsApp al negocio con el detalle completo
6. El cliente ve seguimiento simulado (timer local, no real)
7. El negocio gestiona la entrega de forma independiente
8. El negocio responde al cliente directamente por WhatsApp
```

### Plan Plus

```
1. Cliente abre cravi → Selecciona restaurante
2. Agrega productos al carrito
3. Completa checkout (nombre, teléfono, dirección, método de pago)
4. Confirma pedido → Se genera #MNV{id}
5. cravi envía el pedido al panel del negocio (en tiempo real)
6. Panel del negocio emite alerta sonora/visual de pedido nuevo
7. Negocio acepta el pedido → Estado cambia a "Preparando"
   └── Cliente recibe notificación push: "Tu pedido está siendo preparado"
8. Negocio termina de preparar → Estado: "Listo"
   └── Cliente recibe notificación push: "¡Tu pedido está listo!"
9. Negocio despacha → Estado: "En camino"
   └── Cliente recibe notificación push: "Tu pedido está en camino"
10. Negocio confirma entrega → Estado: "Entregado"
    └── Cliente recibe notificación push: "¡Pedido entregado! Buen provecho 🎉"
    └── Se registra el pedido en estadísticas
```

---

## 10. Integraciones

### 10.1 WhatsApp Business API (Plan Básico y Plus)

**Para Plan Básico:**
- Envío de mensaje al confirmar pedido.
- Se usa el esquema `https://wa.me/{numero}?text={mensaje_codificado}` o la API oficial de WhatsApp Business.
- El negocio registra su número en el panel.

**Para Plan Plus:**
- Adicionalmente: notificación al negocio cuando llega un pedido (como respaldo del panel).
- Notificaciones automáticas al cliente en cada cambio de estado.

### 10.2 Notificaciones Push (Plan Plus)

- Web Push API para notificaciones en el navegador (cliente y negocio).
- Requiere permiso explícito del usuario.
- Payload de la notificación: título, cuerpo, ícono de cravi, URL de destino.

### 10.3 Pasarela de pagos (futuro — v1.1)

En v1.0 solo se registra el método de pago seleccionado (Efectivo / Tarjeta / Transferencia). El cobro ocurre al momento de la entrega.

Integración futura: Stripe o Conekta para cobros en línea con tarjeta.

---

## 11. Stack tecnológico

### Frontend — App del cliente (PWA)

| Componente | Tecnología | Versión |
|---|---|---|
| UI Framework | React | 18.2 |
| Templates | htm (tagged templates) | 3.1 |
| Estilos | CSS puro (variables CSS) | — |
| Tipografía | Plus Jakarta Sans (Google Fonts) | — |
| Empaquetado | Single HTML file | — |
| CDN | jsDelivr | — |

### Frontend — Panel del negocio

| Componente | Tecnología |
|---|---|
| Framework | React 18 + Vite |
| UI Components | Tailwind CSS + shadcn/ui |
| Estado | Zustand |
| Gráficas | Recharts |
| Tablas | TanStack Table |
| Formularios | React Hook Form + Zod |

### Backend

| Componente | Tecnología |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Fastify |
| ORM | Prisma |
| Auth | JWT + refresh tokens |
| Tiempo real | Socket.io |
| Cola de mensajes | BullMQ (Redis) |
| WhatsApp | WhatsApp Business Cloud API |
| Push | Web Push (vapid) |

### Base de datos

| Componente | Tecnología |
|---|---|
| Principal | PostgreSQL 16 |
| Caché / Sesiones | Redis 7 |
| Archivos | Cloudflare R2 (imágenes) |

### Infraestructura

| Componente | Servicio |
|---|---|
| Hosting backend | Railway / Render |
| Hosting frontend | Cloudflare Pages |
| CDN | Cloudflare |
| Dominio | cravi.mx |
| SSL | Let's Encrypt (automático) |
| Monitoreo | Sentry (errores) + Logtail (logs) |

---

## 12. Modelo de datos

### Tablas principales

#### `businesses` (Negocios)
```sql
id              UUID          PK
name            VARCHAR(100)  NOT NULL
slug            VARCHAR(100)  UNIQUE
description     TEXT
category        VARCHAR(50)   -- tacos, pizza, burgers...
whatsapp_number VARCHAR(20)
min_order       DECIMAL(10,2) DEFAULT 0
delivery_time   VARCHAR(20)   -- "20-30"
is_open         BOOLEAN       DEFAULT false
emoji           VARCHAR(10)
gradient        VARCHAR(100)
plan            ENUM('basic', 'plus') DEFAULT 'basic'
plan_expires_at TIMESTAMP
owner_id        UUID          FK → users.id
created_at      TIMESTAMP     DEFAULT NOW()
updated_at      TIMESTAMP
```

#### `business_hours` (Horarios)
```sql
id              UUID          PK
business_id     UUID          FK → businesses.id
day_of_week     SMALLINT      -- 0=Lunes, 6=Domingo
opens_at        TIME
closes_at       TIME
is_closed       BOOLEAN       DEFAULT false
```

#### `categories` (Categorías del menú)
```sql
id              UUID          PK
business_id     UUID          FK → businesses.id
name            VARCHAR(100)  NOT NULL
sort_order      SMALLINT      DEFAULT 0
```

#### `products` (Productos)
```sql
id              UUID          PK
business_id     UUID          FK → businesses.id
category_id     UUID          FK → categories.id
name            VARCHAR(150)  NOT NULL
description     TEXT
price           DECIMAL(10,2) NOT NULL
emoji           VARCHAR(10)
is_available    BOOLEAN       DEFAULT true
sort_order      SMALLINT      DEFAULT 0
created_at      TIMESTAMP     DEFAULT NOW()
updated_at      TIMESTAMP
```

#### `customers` (Clientes)
```sql
id              UUID          PK
name            VARCHAR(100)
phone           VARCHAR(20)
email           VARCHAR(150)  UNIQUE
push_token      TEXT          -- Para notificaciones push
created_at      TIMESTAMP     DEFAULT NOW()
```

#### `orders` (Pedidos)
```sql
id              UUID          PK
order_number    VARCHAR(20)   UNIQUE  -- #MNV4821
business_id     UUID          FK → businesses.id
customer_id     UUID          FK → customers.id
status          ENUM('new','preparing','ready','on_the_way','delivered','rejected')
subtotal        DECIMAL(10,2)
service_fee     DECIMAL(10,2)
total           DECIMAL(10,2)
payment_method  ENUM('cash','card','transfer')
delivery_address TEXT
customer_note   TEXT
internal_note   TEXT          -- Solo visible para el negocio
reject_reason   TEXT
created_at      TIMESTAMP     DEFAULT NOW()
updated_at      TIMESTAMP
```

#### `order_items` (Artículos del pedido)
```sql
id              UUID          PK
order_id        UUID          FK → orders.id
product_id      UUID          FK → products.id
product_name    VARCHAR(150)  NOT NULL  -- Snapshot del nombre al momento del pedido
product_price   DECIMAL(10,2) NOT NULL  -- Snapshot del precio
quantity        SMALLINT      NOT NULL
subtotal        DECIMAL(10,2) NOT NULL
```

#### `order_status_history` (Historial de cambios de estado)
```sql
id              UUID          PK
order_id        UUID          FK → orders.id
from_status     VARCHAR(30)
to_status       VARCHAR(30)
changed_by      UUID          FK → users.id
note            TEXT
created_at      TIMESTAMP     DEFAULT NOW()
```

---

## 13. Reglas de negocio

### Pedidos

1. Un pedido solo puede contener productos del mismo negocio.
2. El monto mínimo del pedido debe ser mayor o igual al `min_order` del negocio.
3. Solo se pueden realizar pedidos a negocios con `is_open = true`.
4. Los precios de los artículos se guardan como snapshot al momento del pedido (no cambian si el negocio actualiza el precio después).
5. El cargo por servicio es del **5%** del subtotal, redondeado al peso más cercano.
6. Un pedido no puede ser cancelado por el cliente una vez que pasa al estado "Preparando".

### Estados del pedido

| Transición | Quién puede hacerla |
|---|---|
| nuevo → preparando | Negocio (Plan Plus) |
| nuevo → rechazado | Negocio (Plan Plus) |
| preparando → listo | Negocio (Plan Plus) |
| listo → en camino | Negocio (Plan Plus) |
| en camino → entregado | Negocio (Plan Plus) |
| cualquier estado → rechazado | Solo desde "nuevo" |

**Plan Básico:** El estado del pedido no es gestionado desde el panel. Se queda en "nuevo" y la gestión es externa (WhatsApp).

### Productos

1. Un producto marcado como "Agotado" no puede ser agregado al carrito.
2. Si un producto se elimina después de ser pedido, el snapshot en `order_items` lo preserva.
3. El precio debe ser mayor a $0 MXN.

### Negocios

1. Un negocio en Plan Básico no tiene acceso a los módulos de estadísticas ni gestión de pedidos.
2. Si el plan expira, el negocio baja automáticamente a Plan Básico.
3. Un negocio puede estar activo o inactivo (no aparece en la app si está inactivo).

---

## 14. Roadmap

### v1.0 — MVP (actual)
- [x] PWA del cliente con las 8 pantallas principales.
- [x] 6 restaurantes de ejemplo con menú completo.
- [x] Flujo completo: home → menú → carrito → checkout → seguimiento.
- [ ] Panel del negocio — Plan Básico (gestión de productos).
- [ ] Integración WhatsApp para envío de pedidos.
- [ ] Backend API con autenticación JWT.

### v1.1 — Panel Plus
- [ ] Panel del negocio — Plan Plus (gestión de pedidos en tiempo real).
- [ ] WebSockets para actualización de estados.
- [ ] Módulo de estadísticas con gráficas.
- [ ] Notificaciones push al cliente.
- [ ] Historial y exportación de reportes.

### v1.2 — Crecimiento
- [ ] Registro de negocios con onboarding guiado.
- [ ] Sistema de reseñas y calificaciones.
- [ ] Búsqueda por ubicación GPS.
- [ ] Favoritos del cliente.
- [ ] Múltiples ubicaciones por negocio.

### v2.0 — Monetización avanzada
- [ ] Integración de pagos en línea (Conekta / Stripe).
- [ ] Cupones y descuentos.
- [ ] Programa de fidelidad (puntos).
- [ ] App nativa iOS / Android (React Native).
- [ ] Expansión a otras ciudades de Tamaulipas.

---

## Apéndice A — Paleta de colores y tipografía

### Colores

| Variable | HEX | Uso |
|---|---|---|
| `--primary` | `#FF4103` | Botones, CTAs, acentos principales |
| `--primary-light` | `#FFF2EE` | Fondos de chips activos, badges |
| `--primary-dark` | `#CC3302` | Hover / Active en botones |
| `--bg` | `#FFFBF8` | Fondo general de la app |
| `--surface` | `#FFFFFF` | Tarjetas, modales, barras |
| `--border` | `#EDE8E3` | Bordes de tarjetas y dividers |
| `--text` | `#001621` | Texto principal |
| `--text-2` | `#6B5F58` | Texto secundario |
| `--text-3` | `#A89890` | Placeholders, labels apagados |
| `--green` | `#22A861` | Estados de éxito, "Abierto" |

### Tipografía

- **Fuente principal:** Plus Jakarta Sans
- **Pesos usados:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold)
- **Tamaños:** 11px (labels), 12px (secondary), 13px (captions), 14px (body), 15–16px (body prominente), 18–20px (títulos), 24–28px (display)

---

## Apéndice B — Nomenclatura de números de pedido

Formato: `#MNV{YYYY}{MM}{DD}{seq4}`  
Ejemplo: `#MNV20260416-0042`

O en versión corta para display: `#MNV4821` (4 dígitos secuenciales por negocio por día).

---

## Apéndice C — Códigos de error de la API

| Código | Descripción |
|---|---|
| `ORDER_MIN_NOT_MET` | El total del pedido no alcanza el mínimo del negocio |
| `BUSINESS_CLOSED` | El negocio está cerrado en este momento |
| `PRODUCT_UNAVAILABLE` | Uno o más productos están marcados como agotados |
| `INVALID_PHONE` | El número de teléfono no tiene el formato correcto |
| `ORDER_NOT_CANCELLABLE` | El pedido ya no puede cancelarse (está en preparación) |
| `PLAN_REQUIRED` | La funcionalidad requiere Plan Plus |

---

*Documento generado para el proyecto cravi — Tampico, Tamaulipas, México.*  
*Contacto del proyecto: hola@cravi.mx*
