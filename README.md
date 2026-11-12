# AgroDecide — JavaScript y Node.js

No requiere Python ni instalar paquetes npm. Necesitas Node.js 20+ y Visual Studio Code.

## Ejecutar

1. Extrae el ZIP y abre la carpeta AgroDecide_JS en VS Code.
2. Abre Terminal > Nueva terminal.
3. Ejecuta: `node --version`
4. Ejecuta: `npm start` (o `node server.js`).
5. Abre http://localhost:8000

## Estructura

- `server.js`: servidor HTTP Node, validación, consultas NASA POWER/Open-Meteo y cálculos.
- `public/index.html`: interfaz.
- `public/style.css`: diseño.
- `public/script.js`: interacciones y gráficas.

## Fuentes y límites

Open-Meteo: pronóstico hasta 16 días. NASA POWER: histórico de 30 días con margen de publicación. NASA puede fallar sin impedir el análisis meteorológico. El suelo (pH, textura y cultivo anterior) es proporcionado por el usuario; no son datos satelitales medidos. El índice 0-100 es heurístico y educativo, NO una probabilidad real de cosecha. Los rangos de cultivos requieren validación agronómica. Mapas y gráficas dependen de bibliotecas externas enlazadas desde la interfaz; requieren Internet. Para conectar una IA con API de pago, guarda la clave solo en el servidor, nunca en public/script.js.
