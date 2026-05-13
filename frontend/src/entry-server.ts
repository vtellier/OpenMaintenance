import { renderToString, serializePayload } from '@arrow-js/ssr'
import { routeToPage, Page } from '@/page'

function renderHead(page: Page) {
  return [
    `<title>${page.title}</title>`,
    `<meta name="description" content="${page.description}" />`,
    '<script>!function(){var t=localStorage.getItem("openmaintenance:theme");if(!t||t==="auto"){t=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}()</script>',
  ].join('')
}

export async function renderPage(url: string) {
  const page = await routeToPage(url)
  const result = await renderToString(page.view)

  return {
    head: renderHead(page),
    html: result.html,
    payloadScript: serializePayload(result.payload),
    status: page.status,
  }
}
