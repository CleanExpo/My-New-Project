# NEW PROJECT PATHWAY - One-Command Initializer
# Usage: irm https://raw.githubusercontent.com/CleanExpo/My-New-Project/main/init.ps1 | iex

param(
    [string]$RepoUrl = "https://github.com/CleanExpo/My-New-Project.git",
    [string]$ProjectName = ""
)

# Colors
function Write-Color {
    param($Text, $Color = "White")
    Write-Host $Text -ForegroundColor $Color -NoNewline
}

function Write-Line {
    param($Text, $Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

Clear-Host
Write-Line @"

╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 NEW PROJECT PATHWAY - Auto Setup                       ║
║                                                              ║
║   AI-Led Development Platform for Non-Coders                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

"@ -Color Cyan

# Check prerequisites
Write-Line "Checking prerequisites..." -Color Yellow

$hasNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $hasNode) {
    Write-Line "❌ Node.js not found. Installing via winget..." -Color Red
    winget install OpenJS.NodeJS
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

$hasGit = Get-Command git -ErrorAction SilentlyContinue
if (-not $hasGit) {
    Write-Line "❌ Git not found. Installing via winget..." -Color Red
    winget install Git.Git
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Get project name if not provided
if (-not $ProjectName) {
    Write-Line "`n📝 YOUR INPUT NEEDED: What's your project name?" -Color Yellow
    Write-Host "   Example: my-awesome-app" -ForegroundColor Gray
    $ProjectName = Read-Host "   Project name"
    
    if (-not $ProjectName) {
        $ProjectName = "my-project-$(Get-Random -Maximum 9999)"
        Write-Line "   Using default: $ProjectName" -Color Gray
    }
}

# Create project directory
Write-Line "`n✅ Creating project: $ProjectName" -Color Green
if (Test-Path $ProjectName) {
    Write-Line "⚠️  Directory exists. Using it anyway..." -Color Yellow
    Set-Location $ProjectName
} else {
    New-Item -ItemType Directory -Path $ProjectName | Out-Null
    Set-Location $ProjectName
}

# Clone repository
Write-Line "✅ Downloading NEW PROJECT PATHWAY..." -Color Green
git init -b main 2>$null
git remote add pathway $RepoUrl 2>$null
git fetch pathway 2>$null
git checkout pathway/main -- . 2>$null

# Clean git history
Remove-Item -Recurse -Force .git -ErrorAction SilentlyContinue
git init -b main

# Install dependencies
Write-Line "✅ Installing dependencies..." -Color Green
npm install --silent

# Create minimal .env
Write-Line "✅ Setting up environment..." -Color Green
@"
# Minimal Required Environment
NODE_ENV=development
NEXT_PUBLIC_APP_NAME=$ProjectName
AI_SERVICE_URL=http://localhost:5051
"@ | Out-File -FilePath .env -Encoding UTF8

# Run environment check
Write-Line "`n🩺 Running health check..." -Color Cyan
npm run env:doctor

# Run build validation
Write-Line "`n🔍 Running build validation..." -Color Cyan
node scripts/build-validator.js

# Create auto-start script
Write-Line "`n✅ Creating launcher..." -Color Green
@"
# Auto-generated launcher for Claude Code
Write-Host '🚀 Launching NEW PROJECT PATHWAY...' -ForegroundColor Cyan
Write-Host ''
Write-Host 'In Claude Code:' -ForegroundColor Yellow
Write-Host '1. Select: Pathway Guide' -ForegroundColor White
Write-Host '2. Paste this BUILD PROMPT:' -ForegroundColor White
Write-Host ''
Get-Content docs/10_prompts/BUILD_PROMPT_v4.1.md | Select-Object -First 50
Write-Host ''
Write-Host '📝 The prompt has been copied to your clipboard!' -ForegroundColor Green
Get-Content docs/10_prompts/BUILD_PROMPT_v4.1.md | Set-Clipboard
Write-Host ''
Write-Host 'Press Enter to open Claude Code...' -ForegroundColor Yellow
Read-Host
claude .
"@ | Out-File -FilePath start-claude.ps1 -Encoding UTF8

# Display next steps
Write-Line "`n" -Color White
Write-Line "══════════════════════════════════════════════════════════════" -Color Cyan
Write-Line "                    ✨ SETUP COMPLETE! ✨" -Color Green
Write-Line "══════════════════════════════════════════════════════════════" -Color Cyan

Write-Line "`nYour project is ready! Here's what to do next:" -Color White
Write-Line ""
Write-Line "OPTION 1: Automatic (Recommended)" -Color Cyan
Write-Line "  .\start-claude.ps1" -Color Yellow
Write-Line "  This will copy the BUILD PROMPT and open Claude Code" -Color Gray
Write-Line ""
Write-Line "OPTION 2: Manual" -Color Cyan
Write-Line "  1. Open Claude Code: claude ." -Color White
Write-Line "  2. Select: Pathway Guide" -Color White
Write-Line "  3. Go to: docs\10_prompts\BUILD_PROMPT_v4.1.md" -Color White
Write-Line "  4. Copy and paste the prompt" -Color White
Write-Line ""
Write-Line "The system will then:" -Color Green
Write-Line "  📝 Ask you questions about your project" -Color White
Write-Line "  ✅ Build everything automatically" -Color White
Write-Line "  🚢 Help you deploy when ready" -Color White
Write-Line ""
Write-Line "══════════════════════════════════════════════════════════════" -Color Cyan

# Offer to start immediately
Write-Line "`n🎯 Ready to start building?" -Color Yellow
$response = Read-Host "Launch Claude Code now? (Y/n)"
if ($response -ne 'n') {
    & .\start-claude.ps1
}