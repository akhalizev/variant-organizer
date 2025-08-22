// Show the UI
figma.showUI(__html__, { width: 300, height: 150 });

// Handle messages from the UI
figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === 'organize-variants') {
    await organizeVariants();
  }
};

// Utility: stable key from properties in a fixed order
function keyFor(props: { [k: string]: string | undefined }, names: string[]): string {
  return names.map((n) => `${n}=${props[n] ?? ''}`).join('|');
}

// Utility: safe font load
async function ensureFontLoaded() {
  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  } catch (_err) {
    // Fallback to default font if Inter isn't available
    // Intentionally swallow error so we still render frames
  }
}

// Utility: detect if a string implies an "On dark" context
function isOnDarkString(s?: string): boolean {
  if (!s) return false;
  return /on\s*dark/i.test(s) || /^dark$/i.test(s.trim());
}

// Utility: detect if any property key or value in the map denotes an "On dark" context
function isOnDarkProps(map: { [k: string]: string | undefined }): boolean {
  for (const k of Object.keys(map)) {
    if (isOnDarkString(k) || isOnDarkString(map[k])) return true;
  }
  return false;
}

async function organizeVariants(): Promise<void> {
  // Determine the component set from selection
  const selection: ReadonlyArray<SceneNode> = figma.currentPage.selection;
  if (
    selection.length !== 1 ||
    (selection[0].type !== 'COMPONENT' && selection[0].type !== 'INSTANCE' && selection[0].type !== 'COMPONENT_SET')
  ) {
    figma.notify('Select a single Component, Instance, or Component Set.');
    return;
  }

  const selected = selection[0];
  let componentSet: ComponentSetNode | null = null;

  if (selected.type === 'COMPONENT_SET') {
    componentSet = selected as ComponentSetNode;
  } else if (selected.type === 'COMPONENT') {
    if (selected.parent && selected.parent.type === 'COMPONENT_SET') {
      componentSet = selected.parent as ComponentSetNode;
    }
  } else if (selected.type === 'INSTANCE') {
    const mainComponent = await selected.getMainComponentAsync();
    if (mainComponent && mainComponent.parent && mainComponent.parent.type === 'COMPONENT_SET') {
      componentSet = mainComponent.parent as ComponentSetNode;
    }
  }

  if (!componentSet) {
    figma.notify('Selected node is not part of a Component Set.');
    return;
  }

  const variants = (componentSet.children.filter((c) => c.type === 'COMPONENT') as ComponentNode[]) || [];
  if (variants.length === 0) {
    figma.notify('No variants found in the Component Set.');
    return;
  }

  // Collect property names and values
  const nameSet = new Set<string>();
  let maxVariantWidth = 0;
  let maxVariantHeight = 0;
  for (const v of variants) {
    const vp = v.variantProperties ?? {};
    Object.keys(vp).forEach((k) => nameSet.add(k));
    if (v.width > maxVariantWidth) maxVariantWidth = v.width;
    if (v.height > maxVariantHeight) maxVariantHeight = v.height;
  }
  const propNames = Array.from(nameSet);

  // Map of property -> possible values (sorted)
  const propertyValues: { [k: string]: string[] } = {};
  // Try using variantGroupProperties if available (shape can vary across typings)
  const vgp: any = (componentSet as any).variantGroupProperties;
  if (vgp && typeof vgp === 'object') {
    for (const k of Object.keys(vgp)) {
      let values: string[] | undefined;
      if (Array.isArray(vgp[k])) values = vgp[k] as string[];
      else if (vgp[k] && Array.isArray(vgp[k].values)) values = vgp[k].values as string[];
      if (values) propertyValues[k] = [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }
  }
  // Fill missing or fallback from actual variants
  for (const k of propNames) {
    if (!propertyValues[k]) {
      const vals = new Set<string>();
      for (const v of variants) {
        const val = (v.variantProperties ?? {})[k];
        if (val) vals.add(val);
      }
      propertyValues[k] = Array.from(vals).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }
  }

  // Build quick lookup from full props -> ComponentNode
  const lookup = new Map<string, ComponentNode>();
  for (const v of variants) {
    const vp = v.variantProperties ?? {};
    lookup.set(keyFor(vp, propNames), v);
  }

  await ensureFontLoaded();

  // Parent container
  const parentFrame = figma.createFrame();
  parentFrame.name = `${componentSet.name} • Variants Table`;
  parentFrame.layoutMode = 'VERTICAL';
  parentFrame.primaryAxisSizingMode = 'AUTO';
  parentFrame.counterAxisSizingMode = 'AUTO';
  parentFrame.itemSpacing = 24;
  parentFrame.paddingLeft = 32;
  parentFrame.paddingRight = 32;
  parentFrame.paddingTop = 32;
  parentFrame.paddingBottom = 32;

  // Title
  const title = figma.createText();
  try {
    title.fontName = { family: 'Inter', style: 'Medium' };
  } catch {}
  title.fontSize = 14;
  title.characters = `${componentSet.name}`;
  parentFrame.appendChild(title);

  // Decide axes
  const rowProp = propNames[0];
  const colProp = propNames[1];
  const otherProps = propNames.slice(2);

  // For grouping when >2 props: create groups for each distinct combination of remaining properties from actual variants
  type PropMap = { [k: string]: string };
  const groupKeyNames = otherProps;
  const groupCombos = new Map<string, PropMap>();
  if (groupKeyNames.length === 0) {
    groupCombos.set('', {});
  } else {
    for (const v of variants) {
      const vp = v.variantProperties ?? {};
      const obj: PropMap = {};
      for (const k of groupKeyNames) obj[k] = vp[k];
      const k = keyFor(obj, groupKeyNames);
      if (!groupCombos.has(k)) groupCombos.set(k, obj);
    }
  }

  // Measure row label width to align cells
  const rowValues = rowProp ? propertyValues[rowProp] : [''];
  let rowLabelWidth = 0;
  for (const rv of rowValues) {
    const t = figma.createText();
    try {
      t.fontName = { family: 'Inter', style: 'Medium' };
    } catch {}
    t.fontSize = 12;
    t.characters = rowProp ? `${rowProp}: ${rv}` : '';
    rowLabelWidth = Math.max(rowLabelWidth, t.width);
    t.remove();
  }
  rowLabelWidth = Math.ceil(rowLabelWidth) + 8; // small padding

  const cellWidth = Math.ceil(maxVariantWidth) + 16; // add some padding per cell

  // Create grids per group
  for (const [, fixedProps] of groupCombos) {
    const groupFrame = figma.createFrame();
    const groupName = groupKeyNames
      .map((k) => `${k}: ${fixedProps[k]}`)
      .filter(Boolean)
      .join(', ');
    groupFrame.name = groupName || 'All Variants';
    groupFrame.layoutMode = 'VERTICAL';
    groupFrame.primaryAxisSizingMode = 'AUTO';
    groupFrame.counterAxisSizingMode = 'AUTO';
    groupFrame.itemSpacing = 8;
    groupFrame.paddingLeft = 12;
    groupFrame.paddingRight = 12;
    groupFrame.paddingTop = 12;
    groupFrame.paddingBottom = 12;
    groupFrame.strokeWeight = 1;
    groupFrame.strokeAlign = 'INSIDE';
    groupFrame.strokes = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }];
    groupFrame.cornerRadius = 6;

    // Detect dark context for this group
    const groupIsDark = isOnDarkProps(fixedProps);
    if (groupIsDark) {
      groupFrame.fills = [{ type: 'SOLID', color: { r: 0.09, g: 0.09, b: 0.11 } }]; // near-black background
    } else {
      groupFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    }

    if (groupName) {
      const label = figma.createText();
      try {
        label.fontName = { family: 'Inter', style: 'Medium' };
      } catch {}
      label.fontSize = 12;
      label.characters = groupName;
      if (groupIsDark) {
        label.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      }
      groupFrame.appendChild(label);
    }

    // Header row: empty spacer + column labels
    const header = figma.createFrame();
    header.layoutMode = 'HORIZONTAL';
    header.primaryAxisSizingMode = 'AUTO';
    header.counterAxisSizingMode = 'AUTO';
    header.itemSpacing = 8;

    const spacer = figma.createFrame();
    spacer.layoutMode = 'HORIZONTAL';
    spacer.primaryAxisSizingMode = 'AUTO';
    spacer.counterAxisSizingMode = 'FIXED';
    spacer.resize(rowLabelWidth, spacer.height);
    header.appendChild(spacer);

    const colValues = colProp ? propertyValues[colProp] : [''];
    for (const cv of colValues) {
      const cell = figma.createFrame();
      cell.layoutMode = 'HORIZONTAL';
      cell.primaryAxisSizingMode = 'AUTO';
      cell.counterAxisSizingMode = 'FIXED';
      cell.resize(cellWidth, cell.height);
      const t = figma.createText();
      try {
        t.fontName = { family: 'Inter', style: 'Medium' };
      } catch {}
      t.fontSize = 12;
      t.characters = colProp ? `${colProp}: ${cv}` : '';
      if (groupIsDark || isOnDarkString(cv)) {
        t.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      }
      cell.appendChild(t);
      header.appendChild(cell);
    }
    groupFrame.appendChild(header);

    // Rows
    for (const rv of rowValues) {
      const row = figma.createFrame();
      row.layoutMode = 'HORIZONTAL';
      row.primaryAxisSizingMode = 'AUTO';
      row.counterAxisSizingMode = 'AUTO';
      row.itemSpacing = 8;

      // Row label
      const rowLabel = figma.createFrame();
      rowLabel.layoutMode = 'HORIZONTAL';
      rowLabel.primaryAxisSizingMode = 'AUTO';
      rowLabel.counterAxisSizingMode = 'FIXED';
      rowLabel.resize(rowLabelWidth, rowLabel.height);
      const t = figma.createText();
      try {
        t.fontName = { family: 'Inter', style: 'Medium' };
      } catch {}
      t.fontSize = 12;
      t.characters = rowProp ? `${rowProp}: ${rv}` : '';
      if (groupIsDark || isOnDarkString(rv)) {
        t.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      }
      rowLabel.appendChild(t);
      row.appendChild(rowLabel);

      // Cells
      for (const cv of colValues) {
        const cell = figma.createFrame();
        cell.layoutMode = 'HORIZONTAL';
        cell.primaryAxisSizingMode = 'AUTO';
        cell.counterAxisSizingMode = 'FIXED';
        cell.counterAxisAlignItems = 'CENTER';
        cell.primaryAxisAlignItems = 'CENTER';
        cell.paddingLeft = 8;
        cell.paddingRight = 8;
        cell.paddingTop = 8;
        cell.paddingBottom = 8;
        cell.itemSpacing = 0;
        cell.resize(cellWidth, cell.height);
        cell.strokeWeight = 1;
        cell.strokeAlign = 'INSIDE';
        if (groupIsDark || isOnDarkString(rv) || isOnDarkString(cv)) {
          cell.strokes = [{ type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.35 } }];
          cell.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.15, b: 0.18 } }];
        } else {
          cell.strokes = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];
          cell.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
        }
        cell.cornerRadius = 4;

        const fullProps: { [k: string]: string } = {};
        for (const n of propNames) {
          if (n === rowProp) fullProps[n] = rv;
          else if (n === colProp) fullProps[n] = cv;
          else if (n in fixedProps) fullProps[n] = fixedProps[n];
        }
        const comp = lookup.get(keyFor(fullProps, propNames));
        if (comp) {
          const instance = comp.createInstance();
          cell.appendChild(instance);
        } else {
          // Placeholder for missing combination
          const rect = figma.createRectangle();
          rect.resize(maxVariantWidth || 48, maxVariantHeight || 48);
          if (groupIsDark || isOnDarkString(rv) || isOnDarkString(cv)) {
            rect.fills = [];
            rect.strokes = [{ type: 'SOLID', color: { r: 1, g: 0.6, b: 0.6 } }];
          } else {
            rect.fills = [];
            rect.strokes = [{ type: 'SOLID', color: { r: 1, g: 0.4, b: 0.4 } }];
          }
          rect.strokeWeight = 1;
          rect.dashPattern = [4, 4];
          rect.name = 'Missing';
          cell.appendChild(rect);
        }

        row.appendChild(cell);
      }

      groupFrame.appendChild(row);
    }

    parentFrame.appendChild(groupFrame);
  }

  // Position the parent frame near selection
  parentFrame.x = selected.x + (selected as any).width + 100;
  parentFrame.y = (selected as any).y;

  // Select and zoom
  figma.currentPage.selection = [parentFrame];
  figma.viewport.scrollAndZoomIntoView([parentFrame]);

  figma.notify(`Rendered ${variants.length} variants across ${propNames.length} properties.`);
}