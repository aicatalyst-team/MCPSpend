import * as vscode from 'vscode'
import {
  runInit,
  runDoctor,
  formatReport,
  formatDoctor,
  saveConfig,
  loadConfig,
} from '@mcpspend/proxy'

const DASHBOARD_URL = 'https://mcpspend.com/dashboard'
const KEYS_URL = 'https://mcpspend.com/dashboard/keys'

let outputChannel: vscode.OutputChannel
let statusBarItem: vscode.StatusBarItem | undefined

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('MCPSpend')
  context.subscriptions.push(outputChannel)

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpspend.init', () => commandInit()),
    vscode.commands.registerCommand('mcpspend.unwrap', () => commandUnwrap()),
    vscode.commands.registerCommand('mcpspend.setApiKey', () => commandSetApiKey()),
    vscode.commands.registerCommand('mcpspend.doctor', () => commandDoctor()),
    vscode.commands.registerCommand('mcpspend.openDashboard', () => {
      void vscode.env.openExternal(vscode.Uri.parse(DASHBOARD_URL))
    }),
  )

  setupStatusBar(context)

  // On first activation, gently prompt setup if no key is configured anywhere.
  void maybePromptFirstRunSetup(context)
}

export function deactivate(): void {
  statusBarItem?.dispose()
}

function setupStatusBar(context: vscode.ExtensionContext): void {
  const enabled = vscode.workspace.getConfiguration('mcpspend').get<boolean>('statusBar.enabled', true)
  if (!enabled) return
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBarItem.command = 'mcpspend.openDashboard'
  statusBarItem.tooltip = 'Open MCPSpend dashboard'
  refreshStatusBar()
  statusBarItem.show()
  context.subscriptions.push(statusBarItem)
}

function refreshStatusBar(): void {
  if (!statusBarItem) return
  const key = resolvedApiKey()
  statusBarItem.text = key ? '$(graph) MCPSpend' : '$(warning) MCPSpend: set key'
}

function resolvedApiKey(): string | undefined {
  const fromSettings = vscode.workspace.getConfiguration('mcpspend').get<string>('apiKey')
  if (fromSettings && fromSettings.trim()) return fromSettings.trim()
  if (process.env.MCPSPEND_API_KEY) return process.env.MCPSPEND_API_KEY
  const cfg = loadConfig()
  return cfg.apiKey
}

async function maybePromptFirstRunSetup(context: vscode.ExtensionContext): Promise<void> {
  const PROMPTED_KEY = 'mcpspend.firstRunPrompted'
  if (context.globalState.get<boolean>(PROMPTED_KEY)) return
  await context.globalState.update(PROMPTED_KEY, true)

  if (resolvedApiKey()) return

  const choice = await vscode.window.showInformationMessage(
    'MCPSpend is installed but has no API key. Set one up to start tracking MCP tool calls?',
    'Set API key',
    'Get a key',
    'Later',
  )
  if (choice === 'Set API key') {
    await commandSetApiKey()
  } else if (choice === 'Get a key') {
    await vscode.env.openExternal(vscode.Uri.parse(KEYS_URL))
  }
}

async function commandSetApiKey(): Promise<void> {
  const value = await vscode.window.showInputBox({
    prompt: 'Paste your MCPSpend API key (starts with mcps_live_ or mcps_test_)',
    placeHolder: 'mcps_live_xxxxxxxxxxxxxxxxxxxxxx',
    ignoreFocusOut: true,
    password: true,
    validateInput: (v) => {
      if (!v) return 'API key is required'
      if (!/^mcps_(live|test)_[A-Za-z0-9_-]{10,}$/.test(v.trim())) {
        return 'Looks like the key format is off — should start with mcps_live_ or mcps_test_'
      }
      return null
    },
  })
  if (!value) return

  const trimmed = value.trim()
  // Persist in ~/.mcpspend/config.json so the CLI proxy picks it up too.
  saveConfig({ apiKey: trimmed })
  outputChannel.appendLine(`Saved API key to ~/.mcpspend/config.json`)
  refreshStatusBar()

  const next = await vscode.window.showInformationMessage(
    'API key saved. Wrap all installed MCP clients now?',
    'Wrap all',
    'Doctor',
    'Not now',
  )
  if (next === 'Wrap all') await commandInit()
  else if (next === 'Doctor') await commandDoctor()
}

async function commandInit(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('mcpspend')
  const projectId = cfg.get<string>('projectId') || undefined
  const endpoint = cfg.get<string>('endpoint') || undefined

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'MCPSpend: wrapping MCP clients…' },
    async () => {
      const report = runInit({ projectId, endpoint, apiKey: vscode.workspace.getConfiguration('mcpspend').get<string>('apiKey') || undefined })
      const text = formatReport(report)
      outputChannel.appendLine(text)
      outputChannel.show(true)

      const errors = report.clients.filter((c: { status: string }) => c.status === 'error')
      if (errors.length) {
        await vscode.window.showErrorMessage(
          `MCPSpend: failed to patch ${errors.length} client(s). See output for details.`,
        )
        return
      }
      if (report.clientsFound === 0) {
        await vscode.window.showWarningMessage(
          'MCPSpend: no supported MCP clients found on this machine. See output for the search paths.',
        )
        return
      }
      const patched = report.clientsPatched
      const msg = patched > 0
        ? `MCPSpend wrapped ${patched} client config(s). Restart Claude Desktop / Cursor / VS Code to apply.`
        : 'MCPSpend: nothing to change — all detected clients are already wrapped.'
      await vscode.window.showInformationMessage(msg)
    },
  )
  refreshStatusBar()
}

async function commandUnwrap(): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    'Restore every wrapped MCP server back to its original command? Backups (.mcpspend.bak) stay in place.',
    { modal: true },
    'Unwrap',
  )
  if (confirm !== 'Unwrap') return

  const report = runInit({ unwrap: true })
  outputChannel.appendLine(formatReport(report, true))
  outputChannel.show(true)
  await vscode.window.showInformationMessage(`MCPSpend: restored ${report.clientsPatched} client config(s).`)
  refreshStatusBar()
}

async function commandDoctor(): Promise<void> {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'MCPSpend: running doctor…' },
    async () => {
      const ext = vscode.extensions.getExtension('mcpspend.mcpspend-vscode')
      const version = (ext?.packageJSON?.version as string) || '0.0.0'
      const report = await runDoctor(version)
      outputChannel.appendLine(formatDoctor(report))
      outputChannel.show(true)
    },
  )
}
