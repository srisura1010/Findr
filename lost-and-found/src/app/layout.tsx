import { ClerkProvider } from "@clerk/nextjs";
import { ItemsProvider } from "@/context/ItemsContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { TTSProvider } from "@/context/TTSContext";
import { GlobalChatProvider } from "@/context/GlobalChatContext";
import Navbar from "./components/Navbar";
import GlobalChatbot from "./components/GlobalChatbot";
import { ThemeProvider } from "./ThemeProvider";
import "./global.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.add(t);document.body.className=t;}catch(e){}})();`,
            }}
          />

          {/* Intentionally left blank */}

          {/*
            Minimal baseline background styles for each theme.

            We keep this inline to avoid a layout flash while global CSS is still
            loading, and to ensure the background matches the early theme script.
          */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
            html, body { margin: 0; padding: 0; }
            body                                      { background-color: #f0f2f8; }
            html[data-theme="light"]         body     { background-color: #f0f2f8; }
            html[data-theme="dark"]          body     { background-color: #0b1120; }
            html[data-theme="midnight"]      body     { background-color: #0b1120; }
            html[data-theme="ocean"]         body     { background-color: #071420; }
            html[data-theme="forest"]        body     { background-color: #071410; }
            html[data-theme="sunset"]        body     { background-color: #180c06; }
            html[data-theme="high-contrast"] body     { background-color: #000000; }
            html[data-theme="protanope"]     body     { background-color: #f8f9ff; }
            html[data-theme="deuteranope"]   body     { background-color: #e6f0ff; }
            html[data-theme="tritanope"]     body     { background-color: #fff0f8; }
          `,
            }}
          />
        </head>

        {/* Intentionally left blank */}

        <body suppressHydrationWarning>
          {/*
            Global providers are layered here so the entire app has access to:

            - Settings (theme, font, language)
            - Theme (applies DOM classes/attributes)
            - Items (Supabase-backed items + realtime updates)
            - TTS (screen-reader style text-to-speech announcements)
            - GlobalChat (persistent floating support chatbot state)
          */}
          <SettingsProvider>
            <ThemeProvider>
              <ItemsProvider>
                <TTSProvider>
                  <GlobalChatProvider>
                    <Navbar />
                    {/*
                      Offset the main content so it isn't hidden behind the fixed
                      top bar (48px) and left sidebar (56px).
                      On mobile the sidebar is hidden, so padding-left drops to 0.
                    */}
                    <main
                      id="main-content"
                      style={{
                        paddingTop: "54px",
                        paddingLeft: "68px",
                      }}
                    >
                      {children}
                    </main>
                    <GlobalChatbot />
                  </GlobalChatProvider>
                </TTSProvider>
              </ItemsProvider>
            </ThemeProvider>
          </SettingsProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
