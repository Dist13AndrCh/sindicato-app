# Command Center - Gestión Sindical

Sistema integral para el control de asistencias, gestión de cobros y emisión de recibos digitales. Diseñado con una interfaz "Dark/Stealth" altamente responsiva y centrado en la eficiencia operativa.

## Configuración y Despliegue (Vercel)

Las credenciales originales están protegidas y no se suben a GitHub (`.gitignore`).
El despliegue en Vercel está automatizado mediante `vercel.json`. Para configurar el proyecto de producción:

1. Ve a los ajustes de tu proyecto en Vercel (Settings > Environment Variables).
2. Crea una variable llamada `FIREBASE_CONFIG_JS`.
3. Pega todo el contenido de tu archivo de configuración de Firebase (`const firebaseConfig = {...}; ...`) como valor de la variable. Vercel creará el archivo automáticamente durante el proceso de *build*.

---
**@Sr.Avila**
> *"La simplicidad es la máxima sofisticación." - Leonardo da Vinci*