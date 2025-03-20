let apiKey = "AIzaSyCS6Sbuay-uzHNsC1aFrXN7EbG7sOnZWBY"; //go ahead abuse this api key
let nodes = [];
let connections = [];
let startNode = null;
let userData = null;

const NodeTypes = {
  DATA: "data",
  EXPLORE: "explore",
  FEATURE: "feature",
  PREPROCESS: "preprocess",
  MODEL: "model",
  TUNE: "tune",
  VALIDATE: "validate",
  EVALUATE: "evaluate",
  SAVE: "save",
};

// Define subtypes for each main option (excluding DATA, which is file input)
const NodeSubtypes = {
  [NodeTypes.EXPLORE]: {
    summary: ["Basic Summary", "Advanced Summary"],
    missing: ["Count Missing", "Highlight Missing"],
    visualize: ["Bar Chart", "Scatter Plot", "Line Chart"],
  },
  [NodeTypes.FEATURE]: {
    encoding: ["One-hot Encoding", "Label Encoding"],
    scaling: ["Min-Max Scaling", "Standard Scaling"],
    selection: ["Filter Methods", "Wrapper Methods"],
  },
  [NodeTypes.PREPROCESS]: {
    split: ["80/20 Split", "70/30 Split"],
    impute: ["Mean Imputation", "Median Imputation"],
    normalize: ["L1 Normalization", "L2 Normalization"],
  },
  [NodeTypes.MODEL]: {
    logistic_regression: ["L1 Regularization", "L2 Regularization"],
    random_forest: ["Shallow Trees", "Deep Trees"],
    svm: ["Linear Kernel", "RBF Kernel"],
    xgboost: ["Tree Booster", "Linear Booster"],
  },
  [NodeTypes.TUNE]: {
    grid: ["Exhaustive Grid", "Step Grid"],
    random: ["Random Sampling", "Monte Carlo"],
    bayesian: ["Gaussian Process", "Tree-structured"],
  },
  [NodeTypes.VALIDATE]: {
    cross_val: ["K-Fold", "Stratified K-Fold"],
    holdout: ["Single Split", "Multiple Splits"],
  },
  [NodeTypes.EVALUATE]: {
    classification: ["Accuracy", "F1 Score", "ROC AUC"],
    regression: ["MSE", "R2 Score"],
    clustering: ["Silhouette Score", "Dunn Index"],
  },
  [NodeTypes.SAVE]: {
    pickle: ["Binary Format", "Protocol 4"],
    onnx: ["Standard ONNX", "Optimized ONNX"],
  },
};

const NodeTemplates = {
  [NodeTypes.DATA]: `
        Data Input
        <input type="file" accept=".csv">
      `,
  [NodeTypes.EXPLORE]: `
        Data Exploration
        <select class="main-select">
          <option value="summary">Summary Statistics</option>
          <option value="missing">Check Missing Values</option>
          <option value="visualize">Visualize Data</option>
        </select>
        <select class="sub-select"></select>
      `,
  [NodeTypes.FEATURE]: `
        Feature Engineering
        <select class="main-select">
          <option value="encoding">Categorical Encoding</option>
          <option value="scaling">Feature Scaling</option>
          <option value="selection">Feature Selection</option>
        </select>
        <select class="sub-select"></select>
      `,
  [NodeTypes.PREPROCESS]: `
        Preprocessing
        <select class="main-select">
          <option value="split">Train-Test Split</option>
          <option value="impute">Impute Missing Values</option>
          <option value="normalize">Normalize Data</option>
        </select>
        <select class="sub-select"></select>
      `,
  [NodeTypes.MODEL]: `
        Model Selection
        <select class="main-select">
          <option value="logistic_regression">Logistic Regression</option>
          <option value="random_forest">Random Forest</option>
          <option value="svm">Support Vector Machine</option>
          <option value="xgboost">XGBoost</option>
        </select>
        <select class="sub-select"></select>
      `,
  [NodeTypes.TUNE]: `
        Model Tuning
        <select class="main-select">
          <option value="grid">Grid Search</option>
          <option value="random">Random Search</option>
          <option value="bayesian">Bayesian Optimization</option>
        </select>
        <select class="sub-select"></select>
      `,
  [NodeTypes.VALIDATE]: `
        Validation
        <select class="main-select">
          <option value="cross_val">Cross-Validation</option>
          <option value="holdout">Holdout Validation</option>
        </select>
        <select class="sub-select"></select>
      `,
  [NodeTypes.EVALUATE]: `
        Evaluation
        <select class="main-select">
          <option value="classification">Classification Metrics</option>
          <option value="regression">Regression Metrics</option>
          <option value="clustering">Clustering Metrics</option>
        </select>
        <select class="sub-select"></select>
      `,
  [NodeTypes.SAVE]: `
        SAVE
        <select class="main-select">
          <option value="pickle">Save as Pickle</option>
          <option value="onnx">Export as ONNX</option>
        </select>
        <select class="sub-select"></select>
      `,
};

function createNode(type, x, y) {
  const node = document.createElement("div");
  node.className = "node";
  node.dataset.type = type;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.innerHTML = NodeTemplates[type];
  node.addEventListener("click", handleNodeClick);
  makeDraggable(node);

  // Add delete button
  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.textContent = "×";
  deleteButton.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent node click event
    deleteNode(node);
  });
  node.appendChild(deleteButton);

  nodes.push(node);
  document.getElementById("canvas").appendChild(node);

  // For nodes with a main-select, initialize the sub-select options
  const mainSelect = node.querySelector(".main-select");
  const subSelect = node.querySelector(".sub-select");
  if (mainSelect && subSelect) {
    // Populate sub-select based on default main option
    updateSubtypes(node);
    // Update sub-select when main select changes
    mainSelect.addEventListener("change", () => updateSubtypes(node));
  }

  // Automatically connect to the previous node if it exists
  if (nodes.length > 1) {
    const previousNode = nodes[nodes.length - 2];
    createConnection(previousNode, node);
  }

  updateConnections(); // Update connections when a new node is added
  return node;
}

function updateSubtypes(node) {
  const type = node.dataset.type;
  const mainSelect = node.querySelector(".main-select");
  const subSelect = node.querySelector(".sub-select");
  if (!mainSelect || !subSelect || !NodeSubtypes[type]) return;

  const mainValue = mainSelect.value;
  const subOptions = NodeSubtypes[type][mainValue] || [];

  // Clear previous options
  subSelect.innerHTML = "";
  // Populate new options
  subOptions.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option;
    opt.textContent = option;
    subSelect.appendChild(opt);
  });
}

function deleteNode(node) {
  // Remove the node from the DOM
  node.remove();

  // Remove the node from the nodes array
  nodes = nodes.filter((n) => n !== node);

  // Remove any connections involving this node
  connections = connections.filter(
    (conn) => conn.from !== node && conn.to !== node
  );

  // Update the connections visually
  updateConnections();
}

function makeDraggable(node) {
  let offsetX, offsetY;

  node.addEventListener("mousedown", (e) => {
    offsetX = e.clientX - node.offsetLeft;
    offsetY = e.clientY - node.offsetTop;

    function mouseMoveHandler(e) {
      node.style.left = `${e.clientX - offsetX}px`;
      node.style.top = `${e.clientY - offsetY}px`;
      updateConnections();
    }

    function mouseUpHandler() {
      document.removeEventListener("mousemove", mouseMoveHandler);
      document.removeEventListener("mouseup", mouseUpHandler);
    }

    document.addEventListener("mousemove", mouseMoveHandler);
    document.addEventListener("mouseup", mouseUpHandler);
  });
}

function handleNodeClick(e) {
  if (startNode === null) {
    startNode = e.currentTarget;
  } else if (startNode !== e.currentTarget) {
    // Check if the target node already has an incoming connection
    const hasIncomingConnection = connections.some(
      (conn) => conn.to === e.currentTarget
    );

    // Check if the start node already has an outgoing connection
    const hasOutgoingConnection = connections.some(
      (conn) => conn.from === startNode
    );

    if (!hasIncomingConnection && !hasOutgoingConnection) {
      createConnection(startNode, e.currentTarget);
    }
    startNode = null;
  }
}

function createConnection(node1, node2) {
  connections.push({ from: node1, to: node2 });
  updateConnections();
}

function updateConnections() {
  const svg = document.querySelector("svg");
  svg.innerHTML = svg.querySelector("defs").outerHTML;

  connections.forEach((conn) => {
    const rect1 = conn.from.getBoundingClientRect();
    const rect2 = conn.to.getBoundingClientRect();
    const canvasRect = document
      .getElementById("canvas")
      .getBoundingClientRect();

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", rect1.left - canvasRect.left + rect1.width / 2);
    line.setAttribute("y1", rect1.top - canvasRect.top + rect1.height / 2);
    line.setAttribute("x2", rect2.left - canvasRect.left + rect2.width / 2);
    line.setAttribute("y2", rect2.top - canvasRect.top + rect2.height / 2);
    svg.appendChild(line);
  });
}

document.querySelectorAll(".component").forEach((comp) => {
  comp.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", comp.dataset.type);
  });
});

document.getElementById("canvas").addEventListener("dragover", (e) => {
  e.preventDefault();
});

document.getElementById("canvas").addEventListener("drop", (e) => {
  e.preventDefault();
  const type = e.dataTransfer.getData("text/plain");
  const canvasRect = document.getElementById("canvas").getBoundingClientRect();
  const x = e.clientX - canvasRect.left;
  const y = e.clientY - canvasRect.top;
  createNode(type, x, y);
});

document.addEventListener("change", (e) => {
  if (e.target.type === "file") {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const csvData = event.target.result;
        userData = parseCSV(csvData);
      };
      reader.readAsText(file);
    }
  }
});

function parseCSV(csvData) {
  const rows = csvData.trim().split("\n");
  const headers = rows[0].split(",");
  return rows.slice(1).map((row) => {
    const values = row.split(",");
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index];
      return obj;
    }, {});
  });
}

document
  .getElementById("generateButton")
  .addEventListener("click", async () => {
    if (!userData) {
      alert("Please upload a dataset first!");
      return;
    }

    // Build workflow data including both main and subtype selections
    const workflow = nodes.map((node) => {
      const mainSelect = node.querySelector(".main-select");
      const subSelect = node.querySelector(".sub-select");
      return {
        type: node.dataset.type,
        mainOption: mainSelect ? mainSelect.value : null,
        subOption: subSelect ? subSelect.value : null,
      };
    });

    const generateButton = document.getElementById("generateButton");
    const generatedCode = document.getElementById("generatedCode");

    // Disable the button and update its text
    generateButton.disabled = true;
    generateButton.textContent = "Generating code...";
    generatedCode.textContent = "";

    // Get the custom prompt (if any)
    const customPrompt = document.getElementById("customPrompt").value.trim();

    // Build the prompt
    const defaultPrompt = `
      Generate Python code for the following ML workflow:
      ${JSON.stringify(workflow)}
      Dataset sample: ${JSON.stringify(userData.slice(0, 5))}
      Include preprocessing, model training, and evaluation.
    `;

    // Append the custom prompt to the default prompt (if provided)
    const prompt = customPrompt
      ? `${defaultPrompt}\n\nAdditional Instructions: ${customPrompt}`
      : defaultPrompt;

    try {
      const code = await generateWithGemini(prompt);
      generatedCode.textContent = code;
    } catch (error) {
      generatedCode.textContent = "Error generating code: " + error.message;
    } finally {
      // Re-enable the button and reset its text
      generateButton.disabled = false;
      generateButton.textContent = "Generate Code";
    }
  });

async function generateWithGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const data = await response.json();
  if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  } else {
    throw new Error("Failed to generate code");
  }
}
