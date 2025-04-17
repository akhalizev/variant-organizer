// Show the UI
figma.showUI(__html__, { width: 300, height: 150 });

// Handle messages from the UI
figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === 'organize-variants') {
    await organizeVariants();
  }
};

async function organizeVariants(): Promise<void> {
  // Get the selected node
  const selection: ReadonlyArray<SceneNode> = figma.currentPage.selection;
  
  if (selection.length !== 1 || (selection[0].type !== 'COMPONENT' && selection[0].type !== 'INSTANCE')) {
    figma.notify('Please select a single Component or Instance.');
    return;
  }

  const selectedNode: ComponentNode | InstanceNode = selection[0] as ComponentNode | InstanceNode;
  let componentSet: ComponentSetNode | null = null;

  // Find the parent component set
  if (selectedNode.type === 'COMPONENT') {
    if (selectedNode.parent && selectedNode.parent.type === 'COMPONENT_SET') {
      componentSet = selectedNode.parent as ComponentSetNode;
    }
  } else if (selectedNode.type === 'INSTANCE') {
    // Use getMainComponentAsync instead of mainComponent property
    const mainComponent = await selectedNode.getMainComponentAsync();
    if (mainComponent && mainComponent.parent && mainComponent.parent.type === 'COMPONENT_SET') {
      componentSet = mainComponent.parent as ComponentSetNode;
    }
  }

  if (!componentSet) {
    figma.notify('Selected component is not part of a Component Set.');
    return;
  }

  const variants: ReadonlyArray<ComponentNode> = componentSet.children as ReadonlyArray<ComponentNode>;

  if (variants.length === 0) {
    figma.notify('No variants found in the Component Set.');
    return;
  }

  // Create a parent frame to hold all variant frames
  const parentFrame: FrameNode = figma.createFrame();
  parentFrame.name = componentSet.name + ' Variants';
  parentFrame.layoutMode = 'VERTICAL';
  parentFrame.primaryAxisSizingMode = 'AUTO';
  parentFrame.counterAxisSizingMode = 'AUTO';
  parentFrame.itemSpacing = 32;
  parentFrame.paddingLeft = 32;
  parentFrame.paddingRight = 32;
  parentFrame.paddingTop = 32;
  parentFrame.paddingBottom = 32;

  // Group variants by their properties for organized framing
  interface VariantGroup {
    properties: { [key: string]: string };
    variants: ComponentNode[];
  }

  const variantGroups: { [key: string]: VariantGroup } = {};
  for (const variant of variants) {
    const properties: { [key: string]: string } = variant.variantProperties ?? {};
    const groupKey: string = JSON.stringify(properties); // Unique key for each property combo
    if (!variantGroups[groupKey]) {
      variantGroups[groupKey] = { properties, variants: [] };
    }
    variantGroups[groupKey].variants.push(variant);
  }

  // Create a frame for each group of variants
  for (const groupKey in variantGroups) {
    const group: VariantGroup = variantGroups[groupKey];
    const properties: { [key: string]: string } = group.properties;
    
    // Create a container frame that will hold both the label and the variants
    const containerFrame: FrameNode = figma.createFrame();
    containerFrame.name = Object.keys(properties)
      .map((key: string) => key + ': ' + properties[key])
      .join(', ');
    containerFrame.layoutMode = 'VERTICAL';
    containerFrame.primaryAxisSizingMode = 'AUTO';
    containerFrame.counterAxisSizingMode = 'AUTO';
    containerFrame.itemSpacing = 8;

    // Create a text label
    const labelText: TextNode = figma.createText();
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    labelText.fontName = { family: "Inter", style: "Medium" };
    labelText.fontSize = 12;
    labelText.characters = Object.keys(properties)
      .map((key: string) => `${key}: ${properties[key]}`)
      .join(', ');
    
    // Add the label to the container
    containerFrame.appendChild(labelText);
    
    // Create a frame for the variants
    const variantFrame: FrameNode = figma.createFrame();
    variantFrame.name = "Variants";
    variantFrame.layoutMode = 'HORIZONTAL';
    variantFrame.primaryAxisSizingMode = 'AUTO';
    variantFrame.counterAxisSizingMode = 'AUTO';
    variantFrame.itemSpacing = 16;

    // Add variant instances to the variant frame
    for (const variant of group.variants) {
      const instance: InstanceNode = variant.createInstance();
      variantFrame.appendChild(instance);
    }

    // Add the variant frame to the container frame
    containerFrame.appendChild(variantFrame);

    // Append the container frame to the parent frame
    parentFrame.appendChild(containerFrame);
  }

  // Position the parent frame to the right of the initially selected node instead of the component set
  parentFrame.x = selectedNode.x + selectedNode.width + 100;
  parentFrame.y = selectedNode.y;

  // Select and zoom to the parent frame
  figma.currentPage.selection = [parentFrame];
  figma.viewport.scrollAndZoomIntoView([parentFrame]);

  figma.notify('Variants organized into frames successfully!');
}