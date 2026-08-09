import { defineConfig, loadEnv } from "vite"
import vue from "@vitejs/plugin-vue"
import { fileURLToPath, URL } from "node:url"

/**
 * Dev-only /gas handler.
 *
 * Apps Script answers /exec with a 302 to
 * script.googleusercontent.com/macros/echo?user_content_key=...
 * Those echo URLs are short-lived and single-use, and this app fires several
 * calls concurrently on mount.
 *
 * Vite's http-proxy handled that badly in both modes: without followRedirects it
 * handed the 302 to the browser (which then 404'd on the echo URL), and with
 * followRedirects it 404'd server-side and returned 404 for /gas itself. Either
 * way requests failed intermittently.
 *
 * Node's fetch follows the redirect correctly — which is exactly what the Vercel
 * function (vue-frontend/api/gas.js) already does in production. Using it here
 * means dev and prod exercise the same transport instead of two different ones.
 */
function gasDevProxy(gasUrl) {
  return {
    name: "pmes-gas-dev-proxy",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/gas", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ success: false, status: 405, data: null, message: "Unsupported request." }))
          return
        }
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = Buffer.concat(chunks).toString("utf8")

          const upstream = await fetch(gasUrl, {
            method: "POST",
            // Apps Script requires text/plain to avoid a CORS preflight; the
            // payload is still JSON and Code.gs parses e.postData.contents.
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body,
            redirect: "follow"
          })

          const text = await upstream.text()
          res.statusCode = 200
          res.setHeader("Content-Type", "application/json; charset=utf-8")
          res.setHeader("Cache-Control", "no-store")
          res.end(text)
        } catch (err) {
          console.error("[PMES dev proxy] upstream call failed:", err?.message || err)
          res.statusCode = 502
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({
            success: false, status: 502, data: null,
            message: "The service is temporarily unavailable. Please try again."
          }))
        }
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const gasUrl = env.VITE_API_BASE_URL

  if (!gasUrl) {
    console.warn("[PMES] VITE_API_BASE_URL is not set — /gas calls will fail in dev.")
  }

  return {
    plugins: [vue(), ...(gasUrl ? [gasDevProxy(gasUrl)] : [])],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    server: {
      port: 5173,
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
      },
      // host: '0.0.0.0',
      // open: true
      open: false
    }
  }
})
