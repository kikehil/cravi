# Resumen de Rebranding: Menvi -> Cravi
**Fecha:** 18 de Abril, 2026

Este documento resume las modificaciones realizadas para completar la transición de identidad de marca de la plataforma.

## 1. Identidad Visual (CSS & Colores)
Se han actualizado los tokens de diseño globales en todos los archivos CSS y etiquetas `<style>`:
- **Principal (`--p`):** `#E8431A` → `#FF4103`
- **Principal Dark (`--pd`):** `#C13410` → `#CC3302`
- **Principal Light (`--pl`):** `#FFF0EC` → `#FFF2EE`
- **Acento (`--p2`):** `#FF9A3C` → `#FF6B2B`
- **Texto (`--t`):** `#1C1412` → `#001621`
- **Gradientes:** Actualizados para usar la nueva paleta naranja vibrante.

## 2. Cambios en Archivos
- **Renombramientos:**
  - `menvi-onboarding.html` → `cravi-onboarding.html`
  - `menvi-specs.md` → `cravi-specs.md`
- **Punto de Entrada:** Se configuró `index.html` como el archivo principal (anteriormente `menvi.html` en versiones previas).

## 3. Integración de Logo (`logo.png`)
Se ha sustituido el branding basado en texto por el nuevo logo oficial en:
- **Splash Screen:** Centrado y escalado a 48px. Se eliminó el emoji redundante para evitar empalmes.
- **Header App:** Integrado en la barra superior (28px) junto a la ubicación del usuario.
- **Panel de Negocio:** Actualizado el encabezado del administrador.
- **Registro:** Sincronizada la barra de progreso con el nuevo logo.
- **Footer:** Añadido como marca de agua sutil en la parte inferior.
- **Favicon:** Configurado como icono de pestaña en todos los módulos.

## 4. Textos y Metadatos
- **Reemplazo Global:** Se cambiaron todas las menciones de "menvi" por "cravi" (respetando mayúsculas/minúsculas).
- **SEO & PWA:**
  - Títulos de página actualizados.
  - `theme-color` actualizado a `#FF4103`.
  - Correos de contacto actualizados a `hola@cravi.mx`.

## 5. Backend y Servidor
- **server.js:** Actualizada la lógica de rutas para apuntar a los nuevos nombres de archivo y servir `index.html` por defecto.

## 6. Repositorio
- **Git:** Inicializado el repositorio local.
- **Exclusiones:** Configurado `.gitignore` para omitir `node_modules`, `.env` y datos locales.
- **GitHub:** Subido exitosamente a `git@github.com:kikehil/cravi.git`.

---
**Estado Final:** La plataforma es 100% operativa bajo la marca **Cravi** con una UI limpia y consistente.
