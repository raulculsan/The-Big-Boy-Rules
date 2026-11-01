# Design

A polished, conventional dark mobile app. Quality references: Instagram, Apple Games and Wallet, Discord.

## Colour
Ground `#000000`, surface `#1c1c1e`, raised `#2c2c2e`, text `#ffffff`, secondary `#ebebf5b3`, muted `#a1a1aa`. Badges use `#ff453a`, online uses `#30d158`. The interface has no brand accent: colour comes from card art, the sede and member photos. Selected states are neutral.

## Type
The platform font: San Francisco on iOS, Roboto on Android. Large titles 34px bold, sections 22px, body 17px, secondary 15px, captions 13px.

## Layout
Five tabs in a full-width bottom bar: Inicio, Hoy, Cartas, Chats and Perfil. Calendar lives in the top bar. Surfaces are flat with a 16px radius and no borders or shadows. Lists sit on the ground with hairline separators.

## Motion and touch
Press feedback lowers opacity in 120ms. Hover styles exist only for precise pointers. Reduced motion is respected.

Tokens live in `app-theme.css` and `visual-system.css`.
