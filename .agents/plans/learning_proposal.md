# 🧠 Learning Proposal: WinForms High-DPI Resizability, Pipeline Hygiene & Symmetric Save Invariant

Based on the diagnosis and resolution of the HUD Configurator GUI layout squishing and controls malfunction on Windows 11 high-DPI displays, this proposal updates **Section 16** of the canonical knowledge base and adds reusable UI and script invariants.

---

## 🎯 Target Locations

1. **`~/.gemini/antigravity/knowledge/runtime_drift_and_self_healing_protocol.md`** (Update Section 16).
2. **`B:\Repos\antigravity-hud\.agents/plans/learning_proposal.md`** (Workspace Invariant Mirror).

---

## 📋 Proposed Invariants to Codify

### 1. The WinForms High-DPI & Resizability Standard (Section 16 Revision)
* **Anti-Pattern (Avoid `SetHighDpiMode(PerMonitorV2)` in PowerShell):** Never invoke `[System.Windows.Forms.Application]::SetHighDpiMode([System.Windows.Forms.HighDpiMode]::PerMonitorV2)` in raw PowerShell scripts without a compiled C# application manifest. Doing so causes .NET WinForms to scale font metrics by monitor DPI (150%–200%) while manual pixel coordinates and container bounds remain unscaled, crushing controls together. Allow Windows DWM to virtualize scaling naturally.
* **Mandatory Sizable Window Standard:** Native desktop dialogs and configurators must **never** be locked to `FixedDialog` with `MaximizeBox = $false`. Always configure:
  ```powershell
  $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::Sizable
  $form.MaximizeBox     = $true
  $form.MinimizeBox     = $true
  $form.AutoScroll      = $true
  $form.MinimumSize     = New-Object System.Drawing.Size(950, 680)
  $form.ClientSize      = New-Object System.Drawing.Size(1060, 800)
  ```
* **Responsive Anchor Layouts:** Every container panel and child control must declare explicit `Anchor` styles (`Top, Left, Right`, `Top, Bottom, Left`, `Top, Bottom, Left, Right`, `Bottom, Left, Right`) so resizing or maximizing dynamically stretches the layout without overlap.
* **Generous Control Dimensions:** All action buttons and dropdowns must allocate generous bounding dimensions (width $\ge 140$px, height $\ge 30$px) to prevent truncated button labels (`Disa`, `Dow`, `Abplv`).

---

### 2. PowerShell Pipeline Return Hygiene Invariant
* **Rule:** In PowerShell scripts hosting WinForms or collection operations, all .NET method calls that return values (e.g. `List<T>.Remove(T)`, `List<T>.Add(T)`, `EnableVisualStyles()`) must be cast to `[void]` or `$null = ...`:
  ```powershell
  [void]$cfg.disabled.Remove($itemKey)
  [void]$cfg[$destKey].Add($itemKey)
  [void][System.Windows.Forms.Application]::EnableVisualStyles()
  ```
* **Failure Mechanism:** Uncast method returns leak boolean or integer tokens onto the standard output pipeline, causing tools launched from the terminal (e.g. `hud gui`) to print `True` / `False` before executing.

---

### 3. Decoupled Visual Selection vs Data Model Indexing
* **Rule:** Never index directly into underlying data structures using a UI control's visual index (`$cfg[$key][$listBox.SelectedIndex]`). When lists are filtered, sorted, or contain inactive elements, visual indices diverge from collection indices.
* **Canonical Pattern:** Always extract the unique item identifier from the selected UI label and resolve its position via `.IndexOf($itemKey)`:
  ```powershell
  $sel = $listBox.SelectedItem
  if ($sel) {
      $itemKey = Extract-KeyFromLabel $sel
      $realIdx = $cfg[$key].IndexOf($itemKey)
      if ($realIdx -ge 0) { ... }
  }
  ```

---

### 4. Multi-Target Symmetric Save Invariant
* **Rule:** Standalone configuration editors must write saved JSON states symmetrically across all active runtime directories (`~/.gemini/scripts/`, `~/.gemini/hud/`) and source repositories (`bin/`):
  ```powershell
  $targets = @(
      (Join-Path $HOME ".gemini\scripts\hud_config.json"),
      (Join-Path $HOME ".gemini\hud\hud_config.json"),
      "B:\Repos\antigravity-hud\bin\hud_config.json"
  )
  ```
* **Benefit:** Eliminates silent runtime drift where settings edited in the GUI fail to take effect in the active statusline engine.

---

## 🔍 Exact Diffs for `~/.gemini/antigravity/knowledge/runtime_drift_and_self_healing_protocol.md`

```markdown
### 16. WinForms High-DPI Resizability, Pipeline Hygiene & Symmetric Save Invariant
* **High-DPI Scaling Standard**: Never call `SetHighDpiMode(PerMonitorV2)` in raw PowerShell scripts without a compiled application manifest. Let Windows DWM handle default DPI virtualization to prevent font metric dilation from crushing fixed layout coordinates.
* **Mandatory Sizable Window Standard**: All WinForms CLI tools must use `FormBorderStyle = 'Sizable'`, `MaximizeBox = $true`, `MinimizeBox = $true`, `AutoScroll = $true`, and set explicit `MinimumSize` and `ClientSize` bounds.
* **Responsive Anchor Layouts**: Container panels and child controls must declare explicit `Anchor` styles (`Top, Left, Right`, `Top, Bottom, Left`, `Top, Bottom, Left, Right`, `Bottom, Left, Right`) to expand smoothly on window resize or maximize.
* **Generous Control Dimensions**: Action buttons and combos must allocate generous widths ($\ge 140$px) to prevent font truncation on high-DPI scaling monitors.
* **PowerShell Pipeline Return Hygiene**: All .NET method invocations returning values (`List<T>.Remove`, `List<T>.Add`, `EnableVisualStyles`) must be prefixed with `[void]` to prevent `True` / `False` tokens from leaking to stdout.
* **Decoupled Visual Selection vs Data Model Indexing**: Never index directly into data structures via `$listBox.SelectedIndex`. Extract the canonical key via `Extract-KeyFromLabel` and resolve `.IndexOf($key)` to ensure 100% precision on filtered or reordered lists.
* **Multi-Target Symmetric Save**: GUI configurators must write atomically across all active runtime directories (`~/.gemini/scripts/`, `~/.gemini/hud/`) and source repositories (`bin/`) to guarantee immediate live HUD synchronization.
```
