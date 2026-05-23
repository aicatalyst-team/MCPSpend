import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-white/5 mt-32">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
            <span className="inline-block w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-brand-700" />
            MCPSpend
          </Link>
          <p className="mt-4 text-gray-400 max-w-sm">
            Cost attribution and observability for MCP tool calls. Built for teams shipping AI to production.
          </p>
        </div>
        <div>
          <h4 className="text-white font-medium mb-3">Product</h4>
          <ul className="space-y-2 text-gray-400">
            <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
            <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
            <li><a href="#how" className="hover:text-white transition-colors">How it works</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-medium mb-3">Company</h4>
          <ul className="space-y-2 text-gray-400">
            <li><a href="mailto:support@mcpspend.com" className="hover:text-white transition-colors">support@mcpspend.com</a></li>
            <li><Link href="/login" className="hover:text-white transition-colors">Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between gap-3 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} MCPSpend. All rights reserved.</span>
          <span>SOC 2 Type II — in progress</span>
        </div>
      </div>
    </footer>
  )
}
