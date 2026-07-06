# Unpacks the four *.skill archives (zip format) into .claude/skills/ so the
# Claude Agent SDK discovers them via settingSources: ['project'].
# Works in both Windows PowerShell 5.1 and PowerShell 7+.
#
# The committed .claude/skills/** folders are the SOURCE OF TRUTH (they carry
# repo-only improvements: methodology grounding, bibliographies, funnel edits).
# The *.skill zips are vestigial first-install seeds, so extraction is
# skip-if-present: an existing skill folder is NEVER overwritten. To force a
# factory reset of one skill: delete its folder, then re-run this script —
# and expect to lose the repo-side improvements (git restore brings them back).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root '.claude\skills'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archives = Get-ChildItem -Path $root -Filter '*.skill' -File
if ($archives.Count -eq 0) {
    Write-Error "No .skill archives found in $root"
}

foreach ($a in $archives) {
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("mag8-skill-" + [System.IO.Path]::GetRandomFileName())
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    [System.IO.Compression.ZipFile]::ExtractToDirectory($a.FullName, $tmp)

    $folders = @(Get-ChildItem -Path $tmp -Directory)
    if ($folders.Count -gt 0) {
        # Normal case: archive contains a single top-level <skill-name>/ folder.
        foreach ($f in $folders) {
            $target = Join-Path $dest $f.Name
            if (Test-Path $target) {
                Write-Host (" - {0}: already installed, left untouched" -f $f.Name)
            }
            else {
                Move-Item -Path $f.FullName -Destination $target
                Write-Host (" - {0}: extracted" -f $f.Name)
            }
        }
    }
    else {
        # Fallback: SKILL.md at archive root — derive folder name from frontmatter.
        $skillMd = Join-Path $tmp 'SKILL.md'
        if (-not (Test-Path $skillMd)) { Write-Error "Archive $($a.Name) contains neither a folder nor SKILL.md" }
        $nameLine = (Select-String -Path $skillMd -Pattern '^name:\s*(.+)$').Matches[0].Groups[1].Value.Trim()
        if (-not $nameLine) { Write-Error "Could not read skill name from $($a.Name)" }
        $target = Join-Path $dest $nameLine
        if (Test-Path $target) {
            Write-Host (" - {0}: already installed, left untouched" -f $nameLine)
        }
        else {
            New-Item -ItemType Directory -Force -Path $target | Out-Null
            Get-ChildItem -Path $tmp | Move-Item -Destination $target
            Write-Host (" - {0}: extracted" -f $nameLine)
        }
    }
    Remove-Item -Recurse -Force $tmp
}

$skillFiles = @(Get-ChildItem -Path $dest -Recurse -Filter 'SKILL.md')
Write-Host "Installed skills ($($skillFiles.Count)):"
foreach ($s in $skillFiles) {
    $nameLine = (Select-String -Path $s.FullName -Pattern '^name:').Line
    Write-Host (" - {0}  [{1}]" -f $s.Directory.Name, $nameLine)
}
if ($skillFiles.Count -lt 4) {
    Write-Error "Expected 4 skills with SKILL.md under $dest, found $($skillFiles.Count)"
}
Write-Host "OK: skills installed to .claude/skills"
