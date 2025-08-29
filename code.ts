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
  // Also try to load Bold for headers
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  } catch (_err) {
    // Fallback to default font if Inter isn't available
    // Intentionally swallow error so we still render frames
  }
}

// Utility: detect if a string implies an "On dark" context
function isOnDarkString(s?: string): boolean {
  if (!s) return false;
  const normalized = s.trim().toLowerCase();
  
  // Check for exact matches and common dark mode patterns
  if (normalized === 'dark') return true;
  if (normalized === 'dark mode') return true;
  if (normalized === 'darkmode') return true;
  if (normalized === 'on dark') return true;
  if (normalized === 'ondark') return true;
  
  // Check for variations with spaces, hyphens, underscores
  if (/dark\s*mode/i.test(normalized)) return true;
  if (/on\s*dark/i.test(normalized)) return true;
  if (/dark\s*theme/i.test(normalized)) return true;
  if (/dark\s*appearance/i.test(normalized)) return true;
  
  // Check for dark mode in different languages/contexts
  if (/dark\s*variant/i.test(normalized)) return true;
  if (/dark\s*style/i.test(normalized)) return true;
  if (/dark\s*color/i.test(normalized)) return true;
  if (/dark\s*background/i.test(normalized)) return true;
  
  // Check for specific dark mode indicators
  if (/🌙|🌑|⚫|⬛/.test(s)) return true; // Dark mode emojis
  
  // Check if the string contains "dark" as a standalone word
  if (normalized.includes('dark')) {
    // Avoid false positives like "darken", "darkroom", "darkness"
    const words = normalized.split(/[\s\-_]+/);
    if (words.indexOf('dark') !== -1) return true;
  }
  
  return false;
}

// Utility: detect if any property key or value in the map denotes an "On dark" context
function isOnDarkProps(map: { [k: string]: string | undefined }): boolean {
  for (const k of Object.keys(map)) {
    if (isOnDarkString(k) || isOnDarkString(map[k])) return true;
  }
  return false;
}

// Utilities for state ordering
const STATE_ORDER: { [k: string]: number } = { default: 0, hover: 1, focus: 2, disabled: 3 };
const STATE_PROP_HINTS = new Set<string>(['state', 'interaction', 'status', 'behavior', 'behaviour', 'pseudo', 'ui state', 'mode']);
const STATE_ALIASES: { [canonical: string]: string[] } = {
  default: ['default', 'base', 'rest', 'enabled', 'normal'],
  hover: ['hover', 'hovered'],
  focus: ['focus', 'focused', 'focus-visible', 'focusvisible'],
  disabled: ['disabled', 'inactive', 'not-enabled', 'notenabled']
};

function normalizeToken(s?: string): string {
  if (!s) return '';
  let t = s.trim().toLowerCase();
  // strip a leading ':' and extra spaces
  if (t.startsWith(':')) t = t.slice(1);
  return t.replace(/\s+/g, ' ');
}

function getStateRank(s?: string): number {
  if (!s) return Number.POSITIVE_INFINITY;
  const cleaned = s.trim().toLowerCase().replace(/^:/, '');
  const tokens = cleaned.split(/[^a-z0-9]+/).filter(Boolean);

  // direct canonical
  if (cleaned in STATE_ORDER) return STATE_ORDER[cleaned];

  // alias match by token
  for (const canonical of Object.keys(STATE_ALIASES)) {
    const aliases = STATE_ALIASES[canonical];
    for (const alias of aliases) {
  if (tokens.indexOf(alias) !== -1) return STATE_ORDER[canonical];
    }
  }
  return Number.POSITIVE_INFINITY;
}

function isStateValueToken(s?: string): boolean {
  return getStateRank(s) !== Number.POSITIVE_INFINITY;
}

function looksLikeStateProperty(propName: string, values: string[]): boolean {
  const pn = normalizeToken(propName);
  if (STATE_PROP_HINTS.has(pn)) return true;
  return values.some((v) => isStateValueToken(v));
}

function sortPropertyValues(propName: string, values: string[]): string[] {
  const applyStateOrder = looksLikeStateProperty(propName, values);
  const withIndex = values.map((v, i) => ({ v, i }));
  withIndex.sort((a, b) => {
    if (applyStateOrder) {
  const sa = getStateRank(a.v);
  const sb = getStateRank(b.v);
      if (sa !== sb) return sa - sb;
    }
    // Fallback to natural alpha-numeric order
    return a.v.localeCompare(b.v, undefined, { numeric: true, sensitivity: 'base' });
  });
  return withIndex.map((x) => x.v);
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

  // Collect property names and values from both variant properties and component properties
  const nameSet = new Set<string>();
  let maxVariantWidth = 0;
  let maxVariantHeight = 0;
  
  for (const v of variants) {
    // Collect variant properties
    const vp = v.variantProperties ?? {};
    Object.keys(vp).forEach((k) => nameSet.add(k));
    
    // Collect component properties (like boolean properties for icon visibility)
    // Try to access component properties through the component's properties
    try {
      // Check if the component has any boolean properties or other component properties
      // We'll look for properties in the component's children that might indicate icon presence
      if (v.children) {
        for (const child of v.children) {
          // Look for icon-related elements or properties
          if (child.name && (child.name.toLowerCase().indexOf('icon') !== -1 || 
                            child.name.toLowerCase().indexOf('left') !== -1 || 
                            child.name.toLowerCase().indexOf('right') !== -1)) {
            nameSet.add('icon');
            break;
          }
        }
      }
      
      // Also check component name for icon-related keywords
      if (v.name) {
        const nameParts = v.name.toLowerCase().split(/[\s\-_]+/);
        if (nameParts.indexOf('icon') !== -1 || nameParts.indexOf('withicon') !== -1 || nameParts.indexOf('noicon') !== -1) {
          nameSet.add('icon');
        }
      }
      
      // Try to detect common component property patterns
      // Look for boolean properties that might be set on the component
      const componentName = v.name.toLowerCase();
      if (componentName.indexOf('has') !== -1 || 
          componentName.indexOf('with') !== -1 || 
          componentName.indexOf('without') !== -1) {
        // This might be a component with boolean properties
        nameSet.add('properties');
      }
      
    } catch (error) {
      // If we can't access component properties, fall back to name-based detection
      if (v.name) {
        const nameParts = v.name.toLowerCase().split(/[\s\-_]+/);
        if (nameParts.indexOf('icon') !== -1 || nameParts.indexOf('withicon') !== -1 || nameParts.indexOf('noicon') !== -1) {
          nameSet.add('icon');
        }
      }
    }
    
    if (v.width > maxVariantWidth) maxVariantWidth = v.width;
    if (v.height > maxVariantHeight) maxVariantHeight = v.height;
  }
  const allPropNames = Array.from(nameSet);

  // Map of property -> possible values (sorted)
  const propertyValues: { [k: string]: string[] } = {};
  
  // Try using variantGroupProperties if available (shape can vary across typings)
  const vgp: any = (componentSet as any).variantGroupProperties;
  if (vgp && typeof vgp === 'object') {
    for (const k of Object.keys(vgp)) {
      let values: string[] | undefined;
      if (Array.isArray(vgp[k])) values = vgp[k] as string[];
      else if (vgp[k] && Array.isArray(vgp[k].values)) values = vgp[k].values as string[];
      if (values) propertyValues[k] = sortPropertyValues(k, [...values]);
    }
  }
  
  // Fill missing or fallback from actual variants
  for (const k of allPropNames) {
    if (!propertyValues[k]) {
      const vals = new Set<string>();
      for (const v of variants) {
        // Check variant properties first
        const vp = v.variantProperties ?? {};
        if (vp[k]) vals.add(vp[k]);
        
        // Check component properties (like boolean properties for icon visibility)
        if (k === 'icon') {
          // Try to detect icon presence from component structure and name
          let hasIcon = false;
          
          try {
            // Check if component has icon-related children
            if (v.children) {
              for (const child of v.children) {
                if (child.name && (child.name.toLowerCase().indexOf('icon') !== -1 || 
                                  child.name.toLowerCase().indexOf('left') !== -1 || 
                                  child.name.toLowerCase().indexOf('right') !== -1)) {
                  hasIcon = true;
                  break;
                }
              }
            }
          } catch (error) {
            // Fall back to name-based detection
          }
          
          // Extract icon information from component name
          const nameParts = v.name.toLowerCase().split(/[\s\-_]+/);
          if (hasIcon || nameParts.indexOf('icon') !== -1 || nameParts.indexOf('withicon') !== -1) {
            vals.add('visible');
          } else if (nameParts.indexOf('noicon') !== -1 || nameParts.indexOf('withouticon') !== -1) {
            vals.add('hidden');
          } else {
            // Default case - check if component has icon elements
            vals.add('unknown');
          }
        }
        
        // Check for general component properties
        if (k === 'properties') {
          // Try to detect if this component has boolean properties
          const componentName = v.name.toLowerCase();
          if (componentName.indexOf('has') !== -1) {
            vals.add('boolean');
          } else if (componentName.indexOf('with') !== -1) {
            vals.add('with');
          } else if (componentName.indexOf('without') !== -1) {
            vals.add('without');
          } else {
            vals.add('default');
          }
        }
      }
      propertyValues[k] = sortPropertyValues(k, Array.from(vals));
    }
  }

  // Build quick lookup from full props -> ComponentNode
  // Reorder properties to prioritize state-like property on columns so ordering is visible
  const statePropName = allPropNames.find((n) => looksLikeStateProperty(n, propertyValues[n] || []));
  let orderedNames: string[] = [...allPropNames];
  if (statePropName) {
    const others = allPropNames.filter((n) => n !== statePropName);
    const rowCandidate = others.length > 0 ? [others[0]] : [];
    const remaining = others.slice(1);
    orderedNames = [...rowCandidate, statePropName, ...remaining];
  }

  const lookup = new Map<string, ComponentNode>();
  for (const v of variants) {
    const vp = v.variantProperties ?? {};
    
    // Combine both variant and component properties
    const combinedProps: { [k: string]: string } = { ...vp };
    
    // Add component properties, converting them to strings
    for (const k of Object.keys(combinedProps)) {
      if (k === 'icon') {
        // Try to detect icon presence from component structure and name
        let hasIcon = false;
        
        try {
          // Check if component has icon-related children
          if (v.children) {
            for (const child of v.children) {
              if (child.name && (child.name.toLowerCase().indexOf('icon') !== -1 || 
                                child.name.toLowerCase().indexOf('left') !== -1 || 
                                child.name.toLowerCase().indexOf('right') !== -1)) {
                hasIcon = true;
                break;
              }
            }
          }
        } catch (error) {
          // Fall back to name-based detection
        }
        
        // Extract icon information from component name
        const nameParts = v.name.toLowerCase().split(/[\s\-_]+/);
        if (hasIcon || nameParts.indexOf('icon') !== -1 || nameParts.indexOf('withicon') !== -1) {
          combinedProps[k] = 'visible';
        } else if (nameParts.indexOf('noicon') !== -1 || nameParts.indexOf('withouticon') !== -1) {
          combinedProps[k] = 'hidden';
        } else {
          combinedProps[k] = 'unknown';
        }
      }
      
      if (k === 'properties') {
        // Set the properties value based on component name
        const componentName = v.name.toLowerCase();
        if (componentName.indexOf('has') !== -1) {
          combinedProps[k] = 'boolean';
        } else if (componentName.indexOf('with') !== -1) {
          combinedProps[k] = 'with';
        } else if (componentName.indexOf('without') !== -1) {
          combinedProps[k] = 'without';
        } else {
          combinedProps[k] = 'default';
        }
      }
    }
    
    lookup.set(keyFor(combinedProps, orderedNames), v);
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
  title.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  parentFrame.appendChild(title);

  // Decide axes
  const rowProp = orderedNames[0];
  const colProp = orderedNames[1];
  const otherProps = orderedNames.slice(2);

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
      groupFrame.fills = [{ type: 'SOLID', color: { r: 0.08, g: 0.08, b: 0.1 } }]; // Darker, more visible background
      groupFrame.strokes = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.45 } }]; // Better contrast border
    } else {
      groupFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    }

    if (groupName) {
      const label = figma.createText();
      try {
        label.fontName = { family: 'Inter', style: 'Bold' };
      } catch {}
      label.fontSize = 16;
      label.characters = groupName;
      if (groupIsDark) {
        label.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      } else {
        label.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
      }
      groupFrame.appendChild(label);
    }

    // Header row: empty spacer + column labels
    const header = figma.createFrame();
    header.layoutMode = 'HORIZONTAL';
    header.primaryAxisSizingMode = 'AUTO';
    header.counterAxisSizingMode = 'FIXED';
  header.resize(header.width, 32); // Fixed height for header row
    header.itemSpacing = 8;

    const spacer = figma.createFrame();
    spacer.layoutMode = 'HORIZONTAL';
    spacer.primaryAxisSizingMode = 'AUTO';
    spacer.counterAxisSizingMode = 'FIXED';
  spacer.resize(rowLabelWidth, 32); // Fixed height to match header
    header.appendChild(spacer);

    const colValues = colProp ? propertyValues[colProp] : [''];
    for (const cv of colValues) {
      const cell = figma.createFrame();
      cell.layoutMode = 'HORIZONTAL';
      cell.primaryAxisSizingMode = 'AUTO';
      cell.counterAxisSizingMode = 'FIXED';
  cell.resize(cellWidth, 32); // Fixed height to match header
      
      // Set background for column header based on whether it's "on dark"
      const colIsDark = isOnDarkString(cv);
      if (colIsDark) {
        cell.fills = [{ type: 'SOLID', color: { r: 0.12, g: 0.12, b: 0.14 } }]; // Darker, more visible background
        cell.strokes = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.45 } }]; // Better contrast border
        cell.strokeWeight = 1;
        cell.cornerRadius = 4;
      }
      
      const t = figma.createText();
      try {
        t.fontName = { family: 'Inter', style: 'Medium' };
      } catch {}
      t.fontSize = 12;
      t.characters = colProp ? `${colProp}: ${cv}` : '';
      if (colIsDark) {
        t.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      } else {
        t.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
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
      
      // Set background for row label based on whether it's "on dark"
      const rowIsDark = isOnDarkString(rv);
      if (rowIsDark) {
        rowLabel.fills = [{ type: 'SOLID', color: { r: 0.12, g: 0.12, b: 0.14 } }]; // Darker, more visible background
        rowLabel.strokes = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.45 } }]; // Better contrast border
        rowLabel.strokeWeight = 1;
        rowLabel.cornerRadius = 4;
      }
      
      const t = figma.createText();
      try {
        t.fontName = { family: 'Inter', style: 'Medium' };
      } catch {}
      t.fontSize = 12;
      t.characters = rowProp ? `${rowProp}: ${rv}` : '';
      if (rowIsDark) {
        t.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      } else {
        t.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
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
          cell.strokes = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.45 } }]; // Better contrast border
          cell.fills = [{ type: 'SOLID', color: { r: 0.12, g: 0.12, b: 0.14 } }]; // Darker, more visible background
        } else {
          cell.strokes = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];
          cell.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
        }
        cell.cornerRadius = 4;

        const fullProps: { [k: string]: string } = {};
  for (const n of orderedNames) {
          if (n === rowProp) fullProps[n] = rv;
          else if (n === colProp) fullProps[n] = cv;
          else if (n in fixedProps) fullProps[n] = fixedProps[n];
        }
  const comp = lookup.get(keyFor(fullProps, orderedNames));
        if (comp) {
          const instance = comp.createInstance();
          cell.appendChild(instance);
        } else {
          // Placeholder for missing combination
          const rect = figma.createRectangle();
          rect.resize(maxVariantWidth || 48, maxVariantHeight || 48);
          if (groupIsDark || isOnDarkString(rv) || isOnDarkString(cv)) {
            rect.fills = [];
            rect.strokes = [{ type: 'SOLID', color: { r: 1, g: 0.7, b: 0.7 } }]; // Better contrast on dark background
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

  figma.notify(`Rendered ${variants.length} variants across ${allPropNames.length} properties.`);
}