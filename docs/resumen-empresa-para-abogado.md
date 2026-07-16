# Datum — resumen para contrato base de servicios

Este documento resume qué es Datum y cómo funciona comercialmente, como insumo para que un abogado redacte un contrato base de servicios entre Datum y sus clientes (pymes colombianas). Varios puntos siguen sin decisión final — se marcan explícitamente como pendientes.

## Qué es Datum

Datum es un servicio de **diagnóstico personalizado + plataforma de gestión** (software como servicio / SaaS) para pequeñas y medianas empresas colombianas. Reúne en un solo sistema: ventas, CRM (relación con clientes), inventario, estado de pérdidas y ganancias, proyecciones e insights, y descuentos/promociones — según qué módulos tenga contratados cada cliente.

El cliente no compra software para instalar ni recibe código fuente: contrata **acceso** a una plataforma web (con usuario y contraseña) que Datum opera, mantiene y actualiza. Es un servicio de suscripción, no un desarrollo de software por encargo.

## Cómo empieza la relación con un cliente

1. **Diagnóstico inicial**: una conversación con el dueño del negocio para entender cómo vende, qué controla hoy y qué necesita.
2. Con base en eso, Datum decide (no el cliente) qué módulos activar y cuál es la pantalla de entrada de la plataforma para ese negocio.
3. Se crea la cuenta del cliente y se le envía por correo el acceso (usuario y contraseña temporal, que debe cambiar en el primer ingreso).

## Estructura comercial

- **Suscripción mensual**, sin cobro inicial de implementación ni de instalación.
- Tres planes según los módulos incluidos (montos **todavía no están en firme**, sujetos a confirmación antes de firmar cualquier contrato):
  - Básico: Ventas + CRM
  - Pro: + Inventario + Estado de pérdidas y ganancias
  - Full: + Proyecciones e Insights
- El módulo de Descuentos y promociones aún no tiene definido en qué plan queda incluido.
- **Desarrollo a la medida para un cliente específico** (algo que requiera código nuevo, no cubierto por la configuración estándar de la plataforma) se cotiza y se cobra aparte de la suscripción, como un proyecto puntual. La forma de cotizar ese trabajo (por horas, por alcance fijo, etc.) **todavía no está definida**.
- **Cobros**: actualmente manuales — transferencia bancaria + factura de venta simple. No hay pasarela de pago ni débito automático integrado todavía.
- **Cancelación**: la política (preaviso, permanencia mínima, qué pasa con los datos del cliente al cancelar) **todavía no está definida** — es uno de los puntos que más valdría la pena que el abogado ayude a resolver.

## Qué NO incluye el servicio (por ahora)

- **Facturación electrónica ante la DIAN**: fuera de alcance. Datum no emite ni gestiona facturación electrónica; eso requeriría integrar un proveedor tecnológico habilitado por la DIAN, algo que no está construido.
- Pasarela de pagos / cobro automático recurrente.
- Multi-sede o "sucursales" bajo una sola cuenta (un negocio con varios puntos de venta): técnicamente es posible pero no está construido — se trataría como un desarrollo a la medida si un cliente lo necesita.

## Dónde viven los datos del cliente

- La aplicación corre sobre infraestructura de terceros: **Supabase** (base de datos) y **Vercel** (hosting) — proveedores externos, no servidores propios de Datum.
- Cada empresa cliente ve únicamente sus propios datos (aislamiento a nivel de base de datos); Datum como operador de la plataforma tiene acceso administrativo para dar soporte y mantenimiento.
- Vale la pena que el abogado revise qué cláusulas de tratamiento de datos personales (Ley 1581 de 2012 / habeas data en Colombia) aplican, dado que la plataforma guarda datos de clientes finales del negocio (nombre, teléfono, correo, historial de compras).

## Estado legal de Datum

- **Aún no está formalizado** como empresa (RUT, Cámara de Comercio) al momento de escribir este resumen — esto es anterior a poder firmar contratos formales y facturar oficialmente, y es responsabilidad de Andrés (el fundador), no algo que dependa del desarrollo del producto.

## Lo que se le pediría al abogado

1. Redactar un contrato base de prestación de servicios (suscripción SaaS) que cubra: alcance del servicio, planes y módulos, forma de pago, duración y cancelación, disponibilidad/soporte, propiedad de los datos del cliente, confidencialidad, y qué pasa si el cliente dejara de pagar.
2. Aclarar qué tan expuesto queda Datum si el cliente pierde información por una falla de un proveedor externo (Supabase/Vercel) — es decir, hasta dónde llega la responsabilidad de Datum como operador vs. la de esos proveedores.
3. Una cláusula clara para el "desarrollo a la medida" cobrado aparte, ya que es un servicio distinto a la suscripción mensual.
