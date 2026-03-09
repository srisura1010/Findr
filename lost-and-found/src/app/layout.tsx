import { ClerkProvider } from "@clerk/nextjs";
import { ItemsProvider } from "@/context/ItemsContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { TTSProvider } from "@/context/TTSContext";
import Navbar from "./components/Navbar";
import { ThemeProvider } from "./ThemeProvider";
import "./global.css";

export default function RootLayout({ children }: { children: React.ReactNode; }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Intentionally left blank */}

          {/*
            Ensure the theme class/data attribute is applied *before* the first paint.

            This prevents a flash of incorrect theme (FOUC) and reduces hydration
            mismatches between server-rendered markup and the client.

            Note: this intentionally runs inline in <head> so it executes ASAP.
          */}
          <script dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.add(t);document.body.className=t;}catch(e){}})();`
          }} />

          {/* Intentionally left blank */}

          {/*
            Minimal baseline background styles for each theme.

            We keep this inline to avoid a layout flash while global CSS is still
            loading, and to ensure the background matches the early theme script.
          */}
          <style dangerouslySetInnerHTML={{ __html: `
            html, body { margin: 0; padding: 0; }
            body                                    { background-color: #f0f2f8; }
            html[data-theme="light"]   body         { background-color: #f0f2f8; }
            html[data-theme="dark"]    body         { background-color: #0b1120; }
            html[data-theme="high-contrast"] body   { background-color: #000000; }
            html[data-theme="colorblind"]    body   { background-color: #e6f0ff; }
          ` }} />
        </head>

        {/* Intentionally left blank */}

        <body suppressHydrationWarning>
          {/*
            Global providers are layered here so the entire app has access to:

            - Settings (theme, font, language)
            - Theme (applies DOM classes/attributes)
            - Items (Supabase-backed items + realtime updates)
            - TTS (screen-reader style text-to-speech announcements)
          */}
          <SettingsProvider>
            <ThemeProvider>
              <ItemsProvider>
                <TTSProvider>
                  <Navbar />
                  {/* Primary landmark region used by the TTS provider to read page content. */}
                  <main id="main-content">
                    {children}
                  </main>
                </TTSProvider>
              </ItemsProvider>
            </ThemeProvider>
          </SettingsProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
