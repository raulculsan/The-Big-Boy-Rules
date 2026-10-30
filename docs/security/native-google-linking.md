# Vinculación nativa con Google

Google se abre en el navegador del sistema, nunca dentro de una WebView. El código de retorno debe usar `bigboyrules://auth/callback`; el SDK lo intercambia con el verificador PKCE que permanece en la app. Un retorno de vinculación con un usuario distinto cierra la sesión y bloquea el enlace.

Android inicia la actividad del navegador en el hilo principal, conserva la llamada mientras se espera y libera el estado al cancelar o caducar. Si Android destruye la actividad mientras Google está abierto, conserva durante un máximo de 15 minutos el código de un solo uso y lo recupera al restaurar la app. Los errores de Google no se interpretan como una vinculación correcta. iOS mantiene ASWebAuthenticationSession y comparte la misma validación del retorno.

Validación automatizada: `node --test scripts/native-auth.test.mjs scripts/account-security.test.mjs scripts/profile-account-sheet.test.mjs`. La compilación Android comprueba el puente Java. La selección de una cuenta y la autorización real de Google deben comprobarse en un Android con la cuenta del usuario; las pruebas simuladas no sustituyen esa comprobación.
