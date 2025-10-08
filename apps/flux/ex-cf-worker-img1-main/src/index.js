export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // API Documentation endpoint
    if (pathname === '/api' || pathname === '/api/docs') {
      return new Response(apiDocsHtml, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    // API Info endpoint
    if (pathname === '/api/info') {
      return new Response(JSON.stringify({
        name: 'AI Image Generation API',
        version: '1.0.0',
        models: [
          {
            id: '@cf/black-forest-labs/flux-1-schnell',
            name: 'FLUX-1-schnell',
            endpoint: '/api/flux',
            description: 'Fast image generation with FLUX model'
          },
          {
            id: '@cf/leonardo/phoenix-1.0',
            name: 'Phoenix 1.0',
            endpoint: '/api/phoenix',
            description: 'High-quality image generation with Phoenix model'
          }
        ]
      }, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // API endpoints for FLUX model
    if (pathname === '/api/flux') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const { prompt, steps = 4, aspectRatio = '1:1' } = await request.json();

      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Prompt is required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      try {
        // Parse aspect ratio
        const [width, height] = aspectRatio.split(':').map(Number);
        let imageWidth = 1024;
        let imageHeight = 1024;
        
        if (aspectRatio === '16:9') {
          imageWidth = 1344;
          imageHeight = 768;
        } else if (aspectRatio === '9:16') {
          imageWidth = 768;
          imageHeight = 1344;
        } else if (aspectRatio === '4:3') {
          imageWidth = 1024;
          imageHeight = 768;
        } else if (aspectRatio === '3:4') {
          imageWidth = 768;
          imageHeight = 1024;
        }
        
        const inputs = {
          prompt: prompt,
          num_steps: Number(steps),
          width: imageWidth,
          height: imageHeight
        };

        const response = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', inputs);

        let imageData;
        if (response.image) {
          imageData = response.image;
        } else if (response instanceof ArrayBuffer) {
          imageData = response;
        } else if (response.data) {
          imageData = response.data;
        } else {
          throw new Error('Unexpected response format');
        }

        // Convert base64 to ArrayBuffer if needed
        if (typeof imageData === 'string') {
          const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          imageData = bytes.buffer;
        }

        return new Response(imageData, {
          headers: {
            'Content-Type': 'image/png',
            'Access-Control-Allow-Origin': '*',
            'X-Model': 'flux-1-schnell',
            'X-Steps': steps.toString(),
            'X-Width': imageWidth.toString(),
            'X-Height': imageHeight.toString()
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // API endpoints for Phoenix model
    if (pathname === '/api/phoenix') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const { 
        prompt, 
        num_steps = 25,
        guidance = 2,
        seed,
        height = 1024,
        width = 1024,
        negative_prompt
      } = await request.json();

      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Prompt is required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      try {
        const inputs = {
          prompt: prompt,
          num_steps: Number(num_steps),
          guidance: Number(guidance),
          height: Number(height),
          width: Number(width)
        };
        
        if (seed !== undefined) {
          inputs.seed = Number(seed);
        }
        
        if (negative_prompt) {
          inputs.negative_prompt = negative_prompt;
        }
        
        const response = await env.AI.run('@cf/leonardo/phoenix-1.0', inputs);

        let imageData;
        
        // Handle ReadableStream response
        if (response instanceof ReadableStream) {
          const reader = response.getReader();
          const chunks = [];
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const result = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
          }
          imageData = result.buffer;
        } else if (response instanceof ArrayBuffer) {
          imageData = response;
        } else if (response instanceof Uint8Array) {
          imageData = response.buffer.slice(response.byteOffset, response.byteOffset + response.byteLength);
        } else {
          throw new Error('Unexpected response format from Phoenix model');
        }

        return new Response(imageData, {
          headers: {
            'Content-Type': 'image/jpeg',
            'Access-Control-Allow-Origin': '*',
            'X-Model': 'phoenix-1.0',
            'X-Steps': num_steps.toString(),
            'X-Guidance': guidance.toString(),
            'X-Width': width.toString(),
            'X-Height': height.toString()
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // Phoenix model endpoint
    if (pathname === '/phoenix') {
      if (request.method === 'GET') {
        return new Response(phoenixHtml, {
          headers: {
            'Content-Type': 'text/html',
          },
        });
      }

      if (request.method === 'POST') {
        const { 
          prompt, 
          num_steps = 25,
          guidance = 2,
          seed,
          height = 1024,
          width = 1024,
          negative_prompt
        } = await request.json();

        if (!prompt) {
          return new Response(JSON.stringify({ error: 'Prompt is required' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        try {
          console.log('Generating image with Phoenix model:', prompt);
          console.log('Steps:', num_steps, 'Guidance:', guidance, 'Size:', width, 'x', height);
          
          const inputs = {
            prompt: prompt,
            num_steps: Number(num_steps),
            guidance: Number(guidance),
            height: Number(height),
            width: Number(width)
          };
          
          if (seed !== undefined) {
            inputs.seed = Number(seed);
          }
          
          if (negative_prompt) {
            inputs.negative_prompt = negative_prompt;
          }
          
          // Phoenix model might return a stream
          const response = await env.AI.run('@cf/leonardo/phoenix-1.0', inputs);

          console.log('Response type:', typeof response);
          console.log('Response constructor:', response?.constructor?.name);
          
          // Check all possible response formats
          let imageData;
          
          // Handle ReadableStream response
          if (response instanceof ReadableStream) {
            console.log('Response is ReadableStream, reading...');
            const reader = response.getReader();
            const chunks = [];
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
            
            // Combine chunks into single ArrayBuffer
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
              result.set(chunk, offset);
              offset += chunk.length;
            }
            imageData = result.buffer;
            console.log('Stream read complete, total bytes:', totalLength);
          } else if (response instanceof ArrayBuffer) {
            console.log('Response is ArrayBuffer');
            imageData = response;
          } else if (response instanceof Uint8Array) {
            console.log('Response is Uint8Array');
            imageData = response.buffer.slice(response.byteOffset, response.byteOffset + response.byteLength);
          } else if (response instanceof Blob) {
            console.log('Response is Blob');
            imageData = await response.arrayBuffer();
          } else if (response?.image) {
            console.log('Response has image property');
            // Handle image property
            if (typeof response.image === 'string') {
              // Base64 encoded
              const base64Data = response.image.replace(/^data:image\/\w+;base64,/, '');
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              imageData = bytes.buffer;
            } else {
              imageData = response.image;
            }
          } else {
            // Log detailed response info for debugging
            console.log('Response keys:', Object.keys(response || {}));
            console.log('Response entries:', Object.entries(response || {}));
            console.log('Response JSON:', JSON.stringify(response).substring(0, 200));
            
            // Check if response itself is the image data
            if (response && Object.keys(response).length === 0) {
              throw new Error('Phoenix model returned empty response. Model might not be available or inputs might be invalid.');
            }
            
            throw new Error(`Unexpected response format from Phoenix model: ${typeof response}`);
          }

          return new Response(imageData, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Access-Control-Allow-Origin': '*',
              'X-Steps': num_steps.toString(),
              'X-Guidance': guidance.toString(),
              'X-Width': width.toString(),
              'X-Height': height.toString()
            },
          });
        } catch (error) {
          console.error('Error generating image:', error);
          return new Response(JSON.stringify({ 
            error: error.message,
            stack: error.stack 
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      }

      return new Response('Method not allowed', { status: 405 });
    }

    // Default FLUX model endpoint
    if (request.method === 'GET') {
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    if (request.method === 'POST') {
      const { prompt, steps = 4, aspectRatio = '1:1' } = await request.json();

      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Prompt is required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      try {
        console.log('Generating image with prompt:', prompt);
        console.log('Steps:', steps, 'Aspect Ratio:', aspectRatio);
        
        // Parse aspect ratio
        const [width, height] = aspectRatio.split(':').map(Number);
        let imageWidth = 1024;
        let imageHeight = 1024;
        
        if (aspectRatio === '16:9') {
          imageWidth = 1344;
          imageHeight = 768;
        } else if (aspectRatio === '9:16') {
          imageWidth = 768;
          imageHeight = 1344;
        } else if (aspectRatio === '4:3') {
          imageWidth = 1024;
          imageHeight = 768;
        } else if (aspectRatio === '3:4') {
          imageWidth = 768;
          imageHeight = 1024;
        }
        
        const inputs = {
          prompt: prompt,
          num_steps: Number(steps),
          width: imageWidth,
          height: imageHeight
        };
        
        // Calculate cost based on Cloudflare pricing
        // FLUX-1-schnell: $0.000053 per 512x512 tile, $0.00011 per step
        // Calculate number of tiles based on image size
        const tileSize = 512;
        const tilesX = Math.ceil(imageWidth / tileSize);
        const tilesY = Math.ceil(imageHeight / tileSize);
        const totalTiles = tilesX * tilesY;
        
        const costPerTile = 0.000053;
        const costPerStep = 0.00011;
        
        const tileCost = totalTiles * costPerTile;
        const stepCost = Number(steps) * costPerStep;
        const totalCostUSD = tileCost + stepCost;
        
        // Convert to THB (assume 35 THB per USD)
        const exchangeRate = 35;
        const totalCostTHB = totalCostUSD * exchangeRate;
        
        // Calculate neurons used
        const neuronsPerTile = 4.80;
        const neuronsPerStep = 9.60;
        const totalNeurons = (totalTiles * neuronsPerTile) + (Number(steps) * neuronsPerStep);

        const response = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', inputs);

        console.log('Response type:', typeof response);
        console.log('Response is ArrayBuffer:', response instanceof ArrayBuffer);
        console.log('Response:', response);
        
        // Check if response has an image property
        let imageData;
        if (response.image) {
          imageData = response.image;
        } else if (response instanceof ArrayBuffer) {
          imageData = response;
        } else if (response.data) {
          imageData = response.data;
        } else {
          console.log('Response structure:', JSON.stringify(response));
          throw new Error('Unexpected response format');
        }

        // Convert base64 to ArrayBuffer if needed
        if (typeof imageData === 'string') {
          // Remove data URL prefix if present
          const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          imageData = bytes.buffer;
        }

        return new Response(imageData, {
          headers: {
            'Content-Type': 'image/png',
            'Access-Control-Allow-Origin': '*',
            'X-Cost-USD': totalCostUSD.toFixed(6),
            'X-Cost-THB': totalCostTHB.toFixed(4),
            'X-Neurons-Used': totalNeurons.toFixed(2),
            'X-Image-Width': imageWidth.toString(),
            'X-Image-Height': imageHeight.toString(),
            'X-Steps': steps.toString(),
            'X-Tiles': totalTiles.toString()
          },
        });
      } catch (error) {
        console.error('Error generating image:', error);
        return new Response(JSON.stringify({ 
          error: error.message,
          stack: error.stack 
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    return new Response('Method not allowed', { status: 405 });
  },
};

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FLUX-1-schnell Image Generator</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f0f0f0;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .input-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        textarea, select, input[type="range"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        textarea {
            resize: vertical;
            min-height: 100px;
        }
        .settings-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .slider-value {
            text-align: right;
            color: #666;
            font-size: 14px;
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            width: 100%;
        }
        button:hover {
            background-color: #45a049;
        }
        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        #result {
            margin-top: 20px;
            text-align: center;
        }
        #result img {
            max-width: 100%;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.2);
        }
        .loading {
            display: none;
            text-align: center;
            margin-top: 20px;
        }
        .error {
            color: red;
            margin-top: 10px;
        }
        .cost-info {
            background-color: #e3f2fd;
            padding: 15px;
            border-radius: 5px;
            margin-top: 15px;
            font-size: 14px;
        }
        .cost-amount {
            font-weight: bold;
            color: #1976d2;
        }
        .cost-preview {
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 15px;
            font-size: 14px;
            border-left: 4px solid #4CAF50;
        }
        .cost-preview .price {
            font-weight: bold;
            color: #2e7d32;
        }
        .cost-details {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
        .quantity-input {
            width: 80px;
            text-align: center;
        }
        .generate-buttons {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
            align-items: center;
        }
        .timer-info {
            background-color: #fff3e0;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
            font-size: 14px;
            border-left: 4px solid #ff9800;
            display: none;
        }
        .progress-bar {
            width: 100%;
            height: 8px;
            background-color: #e0e0e0;
            border-radius: 4px;
            margin: 10px 0;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background-color: #4CAF50;
            width: 0%;
            transition: width 0.3s ease;
        }
        .image-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .image-grid img {
            width: 100%;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>FLUX-1-schnell Image Generator</h1>
        <div class="input-group">
            <label for="prompt">Enter your prompt:</label>
            <textarea id="prompt" placeholder="e.g., A beautiful sunset over mountains with vibrant colors"></textarea>
        </div>
        
        <div class="settings-grid">
            <div class="input-group">
                <label for="steps">Steps: <span id="stepsValue" class="slider-value">4</span></label>
                <input type="range" id="steps" min="1" max="8" value="4" onchange="updateStepsValue()">
            </div>
            <div class="input-group">
                <label for="aspectRatio">Aspect Ratio:</label>
                <select id="aspectRatio">
                    <option value="1:1">1:1 (Square)</option>
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="9:16">9:16 (Portrait)</option>
                    <option value="4:3">4:3 (Classic)</option>
                    <option value="3:4">3:4 (Classic Portrait)</option>
                </select>
            </div>
        </div>
        
        <div id="costPreview" class="cost-preview">
            💰 <span class="price" id="previewPrice">0.02 บาท ($0.000634 USD)</span>
            <div class="cost-details" id="previewDetails">
                Tiles: 4 (2×2) • Steps: 4 • Neurons: 57.6
            </div>
        </div>
        
        <div class="generate-buttons">
            <button id="generateBtn" onclick="generateImage(1)">Generate 1 Image</button>
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="number" id="quantity" class="quantity-input" value="10" min="1" max="20" onchange="updateQuantityPreview()">
                <button id="generateMultiBtn" onclick="generateMultipleImages()">Generate Multiple</button>
            </div>
        </div>
        <div class="loading" id="loading">
            <p id="loadingText">Generating image... This may take a moment.</p>
            <div class="progress-bar" id="progressBar" style="display: none;">
                <div class="progress-fill" id="progressFill"></div>
            </div>
        </div>
        
        <div class="timer-info" id="timerInfo">
            ⏱️ <span id="timerText">Total time: 0.00 seconds</span>
            <div style="margin-top: 5px; font-size: 12px;">
                Generated: <span id="generatedCount">0</span> / <span id="totalCount">1</span> images
            </div>
        </div>
        
        <div id="error" class="error"></div>
        <div id="costInfo" class="cost-info" style="display: none;">
            <div>Total Cost: <span class="cost-amount" id="costAmountTHB">0.00 บาท</span> (<span id="costAmountUSD">$0.000000</span> USD)</div>
            <div style="margin-top: 5px; font-size: 12px; color: #666;">
                Neurons used: <span id="neuronsUsed">0</span> | Tiles: <span id="tilesUsed">0</span>
            </div>
        </div>
        <div id="result" class="image-grid"></div>
    </div>

    <script>
        function calculatePreviewCost() {
            const steps = parseInt(document.getElementById('steps').value);
            const aspectRatio = document.getElementById('aspectRatio').value;
            
            // Determine image dimensions (varied sizes to show cost difference)
            let imageWidth = 1024, imageHeight = 1024;
            if (aspectRatio === '16:9') {
                imageWidth = 1344; imageHeight = 768;  // 3x2 tiles = 6 tiles
            } else if (aspectRatio === '9:16') {
                imageWidth = 768; imageHeight = 1344;  // 2x3 tiles = 6 tiles  
            } else if (aspectRatio === '4:3') {
                imageWidth = 1024; imageHeight = 768;  // 2x2 tiles = 4 tiles
            } else if (aspectRatio === '3:4') {
                imageWidth = 768; imageHeight = 1024;  // 2x2 tiles = 4 tiles
            }
            
            // Calculate tiles
            const tileSize = 512;
            const tilesX = Math.ceil(imageWidth / tileSize);
            const tilesY = Math.ceil(imageHeight / tileSize);
            const totalTiles = tilesX * tilesY;
            
            // Debug log
            console.log(\`Aspect: \${aspectRatio}, Size: \${imageWidth}x\${imageHeight}, Tiles: \${tilesX}x\${tilesY} = \${totalTiles}\`);
            
            // Calculate cost
            const costPerTile = 0.000053;
            const costPerStep = 0.00011;
            const tileCost = totalTiles * costPerTile;
            const stepCost = steps * costPerStep;
            const totalCostUSD = tileCost + stepCost;
            const totalCostTHB = totalCostUSD * 35; // 35 THB per USD
            
            // Calculate neurons
            const neuronsPerTile = 4.80;
            const neuronsPerStep = 9.60;
            const totalNeurons = (totalTiles * neuronsPerTile) + (steps * neuronsPerStep);
            
            // Update preview with quantity
            const quantity = parseInt(document.getElementById('quantity').value) || 1;
            const totalQuantityCostTHB = totalCostTHB * quantity;
            const totalQuantityCostUSD = totalCostUSD * quantity;
            
            document.getElementById('previewPrice').textContent = 
                \`\${totalCostTHB.toFixed(2)} บาท ($\${totalCostUSD.toFixed(6)} USD) per image\`;
            document.getElementById('previewDetails').textContent = 
                \`\${imageWidth}×\${imageHeight} • Tiles: \${totalTiles} (\${tilesX}×\${tilesY}) • Steps: \${steps} • Neurons: \${totalNeurons.toFixed(1)} | \${quantity} images = \${totalQuantityCostTHB.toFixed(2)} บาท\`;
        }

        function updateStepsValue() {
            const steps = document.getElementById('steps').value;
            document.getElementById('stepsValue').textContent = steps;
            calculatePreviewCost();
        }

        function updateQuantityPreview() {
            calculatePreviewCost();
        }

        let startTime = 0;
        let timerInterval = null;

        function startTimer() {
            startTime = Date.now();
            document.getElementById('timerInfo').style.display = 'block';
            
            timerInterval = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                document.getElementById('timerText').textContent = \`Total time: \${elapsed.toFixed(2)} seconds\`;
            }, 100);
        }

        function stopTimer() {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            const elapsed = (Date.now() - startTime) / 1000;
            document.getElementById('timerText').textContent = \`Total time: \${elapsed.toFixed(2)} seconds\`;
        }

        async function generateSingleImage(prompt, steps, aspectRatio) {
            const response = await fetch('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    prompt,
                    steps: parseInt(steps),
                    aspectRatio
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate image');
            }

            return response;
        }

        async function generateImage(count = 1) {
            const prompt = document.getElementById('prompt').value;
            const steps = document.getElementById('steps').value;
            const aspectRatio = document.getElementById('aspectRatio').value;
            
            if (!prompt) {
                document.getElementById('error').textContent = 'Please enter a prompt';
                return;
            }

            document.getElementById('generateBtn').disabled = true;
            document.getElementById('generateMultiBtn').disabled = true;
            document.getElementById('loading').style.display = 'block';
            document.getElementById('result').innerHTML = '';
            document.getElementById('error').textContent = '';
            document.getElementById('costInfo').style.display = 'none';
            document.getElementById('totalCount').textContent = count;
            document.getElementById('generatedCount').textContent = '0';

            if (count > 1) {
                document.getElementById('progressBar').style.display = 'block';
                document.getElementById('loadingText').textContent = \`Generating \${count} images...\`;
            } else {
                document.getElementById('progressBar').style.display = 'none';
                document.getElementById('loadingText').textContent = 'Generating image...';
            }

            startTimer();

            try {
                let totalCostUSD = 0;
                let totalCostTHB = 0;
                let totalNeurons = 0;
                let totalTiles = 0;
                const images = [];

                // Generate images one by one to avoid timeout
                for (let i = 0; i < count; i++) {
                    const response = await generateSingleImage(prompt, steps, aspectRatio);
                    
                    // Update progress
                    const progress = ((i + 1) / count) * 100;
                    document.getElementById('progressFill').style.width = progress + '%';
                    document.getElementById('generatedCount').textContent = (i + 1).toString();

                    // Get cost data
                    const costUSD = parseFloat(response.headers.get('X-Cost-USD') || '0');
                    const costTHB = parseFloat(response.headers.get('X-Cost-THB') || '0');
                    const neurons = parseFloat(response.headers.get('X-Neurons-Used') || '0');
                    const tiles = parseInt(response.headers.get('X-Tiles') || '0');

                    totalCostUSD += costUSD;
                    totalCostTHB += costTHB;
                    totalNeurons += neurons;
                    totalTiles += tiles;

                    // Get image
                    const blob = await response.blob();
                    const imageUrl = URL.createObjectURL(blob);
                    images.push(imageUrl);

                    // Show images as they complete
                    const resultDiv = document.getElementById('result');
                    resultDiv.innerHTML = images.map((url, index) => 
                        \`<img src="\${url}" alt="Generated image \${index + 1}">\`
                    ).join('');
                }

                // Show cost info
                document.getElementById('costAmountTHB').textContent = totalCostTHB.toFixed(2) + ' บาท';
                document.getElementById('costAmountUSD').textContent = '$' + totalCostUSD.toFixed(6);
                document.getElementById('neuronsUsed').textContent = totalNeurons.toFixed(1);
                document.getElementById('tilesUsed').textContent = totalTiles.toString();
                document.getElementById('costInfo').style.display = 'block';

            } catch (error) {
                document.getElementById('error').textContent = 'Error: ' + error.message;
            } finally {
                stopTimer();
                document.getElementById('generateBtn').disabled = false;
                document.getElementById('generateMultiBtn').disabled = false;
                document.getElementById('loading').style.display = 'none';
            }
        }

        async function generateMultipleImages() {
            const count = parseInt(document.getElementById('quantity').value);
            await generateImage(count);
        }

        document.getElementById('prompt').addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generateImage();
            }
        });

        // Update cost preview when aspect ratio changes
        document.getElementById('aspectRatio').addEventListener('change', calculatePreviewCost);
        
        // Initialize cost preview on page load
        document.addEventListener('DOMContentLoaded', calculatePreviewCost);
    </script>
</body>
</html>
`;

const apiDocsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Image Generation API Documentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; color: #333; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }
        header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; }
        header h1 { font-size: 2.5em; margin-bottom: 10px; }
        header p { font-size: 1.2em; opacity: 0.9; }
        nav { background: #f8f9fa; padding: 20px 40px; border-bottom: 1px solid #dee2e6; }
        nav ul { list-style: none; display: flex; gap: 30px; flex-wrap: wrap; }
        nav a { color: #667eea; text-decoration: none; font-weight: 500; transition: color 0.3s; }
        nav a:hover { color: #764ba2; }
        .content { padding: 40px; }
        section { margin-bottom: 60px; }
        h2 { color: #667eea; font-size: 2em; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #667eea; }
        h3 { color: #764ba2; font-size: 1.5em; margin: 30px 0 15px; }
        .endpoint-card { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .method { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 0.9em; margin-right: 10px; }
        .method.post { background: #28a745; color: white; }
        .method.get { background: #007bff; color: white; }
        .endpoint { font-family: 'Monaco', 'Courier New', monospace; font-size: 1.1em; color: #495057; }
        .parameter-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .parameter-table th { background: #f8f9fa; padding: 12px; text-align: left; border: 1px solid #dee2e6; }
        .parameter-table td { padding: 12px; border: 1px solid #dee2e6; }
        .parameter-table .required { color: #dc3545; font-weight: bold; }
        .parameter-table .optional { color: #6c757d; }
        pre { background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 8px; overflow-x: auto; margin: 20px 0; }
        code { font-family: 'Monaco', 'Courier New', monospace; background: #f8f9fa; padding: 2px 6px; border-radius: 3px; color: #e83e8c; }
        pre code { background: none; color: inherit; padding: 0; }
        .quick-start { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin: 30px 0; }
        .quick-start h3 { color: white; margin-bottom: 20px; }
        .quick-start pre { background: rgba(0,0,0,0.3); }
        .model-comparison { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0; }
        .model-card { border: 2px solid #dee2e6; border-radius: 12px; padding: 20px; transition: transform 0.3s, box-shadow 0.3s; }
        .model-card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .model-card h4 { color: #667eea; margin-bottom: 15px; }
        .model-features { list-style: none; margin: 15px 0; }
        .model-features li { padding: 5px 0; padding-left: 20px; position: relative; }
        .model-features li:before { content: "✓"; position: absolute; left: 0; color: #28a745; font-weight: bold; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 0.85em; font-weight: 500; }
        .badge.new { background: #28a745; color: white; }
        .badge.beta { background: #ffc107; color: #333; }
        footer { background: #f8f9fa; padding: 30px; text-align: center; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🎨 AI Image Generation API</h1>
            <p>RESTful API for generating images using FLUX and Phoenix models</p>
        </header>
        
        <nav>
            <ul>
                <li><a href="#overview">Overview</a></li>
                <li><a href="#models">Models</a></li>
                <li><a href="#flux-api">FLUX API</a></li>
                <li><a href="#phoenix-api">Phoenix API</a></li>
                <li><a href="#examples">Examples</a></li>
            </ul>
        </nav>
        
        <div class="content">
            <section id="overview">
                <h2>Overview</h2>
                <p>This API provides access to two state-of-the-art AI image generation models: FLUX-1-schnell and Leonardo Phoenix 1.0.</p>
                
                <div class="quick-start">
                    <h3>Quick Start</h3>
                    <p>Generate your first image:</p>
                    <pre><code>curl -X POST https://flux-image-generator.aiunlocked.workers.dev/api/flux \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "a beautiful sunset over mountains"}' \\
  --output image.png</code></pre>
                </div>
                
                <h3>Base URL</h3>
                <pre><code>https://flux-image-generator.aiunlocked.workers.dev</code></pre>
                
                <h3>Available Endpoints</h3>
                <ul>
                    <li><code>GET /api/info</code> - Get API information</li>
                    <li><code>POST /api/flux</code> - Generate image with FLUX model</li>
                    <li><code>POST /api/phoenix</code> - Generate image with Phoenix model</li>
                </ul>
            </section>
            
            <section id="models">
                <h2>Available Models</h2>
                <div class="model-comparison">
                    <div class="model-card">
                        <h4>FLUX-1-schnell <span class="badge new">Fast</span></h4>
                        <p>Optimized for speed with good quality.</p>
                        <ul class="model-features">
                            <li>1-8 inference steps</li>
                            <li>~2-3 seconds generation time</li>
                            <li>Supports aspect ratios</li>
                            <li>PNG output format</li>
                        </ul>
                    </div>
                    <div class="model-card">
                        <h4>Phoenix 1.0 <span class="badge beta">Quality</span></h4>
                        <p>High-quality image generation with advanced control.</p>
                        <ul class="model-features">
                            <li>1-50 inference steps</li>
                            <li>Guidance scale control</li>
                            <li>Negative prompts</li>
                            <li>Custom dimensions up to 2048px</li>
                            <li>JPEG output format</li>
                            <li>Seed support</li>
                        </ul>
                    </div>
                </div>
            </section>
            
            <section id="flux-api">
                <h2>FLUX Model API</h2>
                
                <div class="endpoint-card">
                    <span class="method post">POST</span>
                    <span class="endpoint">/api/flux</span>
                </div>
                
                <h3>Request Parameters</h3>
                <table class="parameter-table">
                    <thead>
                        <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Default</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                        <tr><td><code>prompt</code></td><td>string</td><td class="required">Yes</td><td>-</td><td>Text description of the image</td></tr>
                        <tr><td><code>steps</code></td><td>integer</td><td class="optional">No</td><td>4</td><td>Number of inference steps (1-8)</td></tr>
                        <tr><td><code>aspectRatio</code></td><td>string</td><td class="optional">No</td><td>"1:1"</td><td>Aspect ratio: "1:1", "16:9", "9:16", "4:3", "3:4"</td></tr>
                    </tbody>
                </table>
                
                <h3>Example Request</h3>
                <pre><code>curl -X POST https://flux-image-generator.aiunlocked.workers.dev/api/flux \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "cyberpunk city at night",
    "steps": 4,
    "aspectRatio": "16:9"
  }' \\
  --output image.png</code></pre>
            </section>
            
            <section id="phoenix-api">
                <h2>Phoenix Model API</h2>
                
                <div class="endpoint-card">
                    <span class="method post">POST</span>
                    <span class="endpoint">/api/phoenix</span>
                </div>
                
                <h3>Request Parameters</h3>
                <table class="parameter-table">
                    <thead>
                        <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Default</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                        <tr><td><code>prompt</code></td><td>string</td><td class="required">Yes</td><td>-</td><td>Text description of the image</td></tr>
                        <tr><td><code>num_steps</code></td><td>integer</td><td class="optional">No</td><td>25</td><td>Number of steps (1-50)</td></tr>
                        <tr><td><code>guidance</code></td><td>number</td><td class="optional">No</td><td>2</td><td>Guidance scale (2-10)</td></tr>
                        <tr><td><code>width</code></td><td>integer</td><td class="optional">No</td><td>1024</td><td>Width in pixels (max 2048)</td></tr>
                        <tr><td><code>height</code></td><td>integer</td><td class="optional">No</td><td>1024</td><td>Height in pixels (max 2048)</td></tr>
                        <tr><td><code>seed</code></td><td>integer</td><td class="optional">No</td><td>random</td><td>Random seed</td></tr>
                        <tr><td><code>negative_prompt</code></td><td>string</td><td class="optional">No</td><td>-</td><td>What to exclude</td></tr>
                    </tbody>
                </table>
                
                <h3>Example Request</h3>
                <pre><code>curl -X POST https://flux-image-generator.aiunlocked.workers.dev/api/phoenix \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "majestic phoenix rising from flames",
    "num_steps": 30,
    "guidance": 7.5,
    "width": 1920,
    "height": 1080
  }' \\
  --output phoenix.jpg</code></pre>
            </section>
            
            <section id="examples">
                <h2>Common Use Cases</h2>
                
                <h4>1. Square Avatar</h4>
                <pre><code>{"prompt": "professional headshot", "aspectRatio": "1:1"}</code></pre>
                
                <h4>2. YouTube Thumbnail</h4>
                <pre><code>{"prompt": "exciting thumbnail", "width": 1280, "height": 720}</code></pre>
                
                <h4>3. Instagram Story</h4>
                <pre><code>{"prompt": "aesthetic scene", "aspectRatio": "9:16"}</code></pre>
                
                <h4>4. Consistent Style</h4>
                <pre><code>{"prompt": "fantasy landscape", "seed": 42, "guidance": 8}</code></pre>
            </section>
        </div>
        
        <footer>
            <p>&copy; 2025 AI Image Generation API | Powered by Cloudflare Workers AI</p>
        </footer>
    </div>
</body>
</html>
`;

const phoenixHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phoenix 1.0 Image Generator</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 {
            color: #333;
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 30px;
        }
        .model-badge {
            text-align: center;
            margin-bottom: 20px;
        }
        .model-badge span {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
        }
        .input-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: #555;
        }
        textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            resize: vertical;
            min-height: 120px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        textarea:focus {
            outline: none;
            border-color: #667eea;
        }
        .settings-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
        }
        @media (max-width: 768px) {
            .settings-grid {
                grid-template-columns: 1fr;
            }
        }
        input[type="range"] {
            width: 100%;
            margin-top: 10px;
        }
        .slider-container {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
        }
        .slider-value {
            float: right;
            color: #667eea;
            font-weight: bold;
            font-size: 18px;
        }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 14px 28px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            width: 100%;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        #result {
            margin-top: 30px;
            text-align: center;
        }
        #result img {
            max-width: 100%;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            margin-top: 20px;
        }
        .loading {
            display: none;
            text-align: center;
            margin-top: 20px;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error {
            color: #f5576c;
            margin-top: 15px;
            padding: 10px;
            background: #ffe0e3;
            border-radius: 8px;
            display: none;
        }
        .examples {
            margin-top: 20px;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 8px;
        }
        .examples h3 {
            margin-top: 0;
            color: #667eea;
        }
        .example-prompt {
            background: white;
            padding: 8px 12px;
            border-radius: 5px;
            margin: 5px 0;
            cursor: pointer;
            transition: background 0.2s;
            font-size: 13px;
        }
        .example-prompt:hover {
            background: #e8eaf6;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 Phoenix 1.0 Image Generator</h1>
        <div class="model-badge">
            <span>Leonardo Phoenix Model</span>
        </div>
        
        <div class="input-group">
            <label for="prompt">Enter your prompt:</label>
            <textarea id="prompt" placeholder="Describe the image you want to generate..."></textarea>
        </div>
        
        <div class="settings-grid">
            <div class="slider-container">
                <label for="steps">Generation Steps: <span id="stepsValue" class="slider-value">25</span></label>
                <input type="range" id="steps" min="1" max="50" value="25" onchange="updateStepsValue()">
                <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px; color: #999;">
                    <span>Fastest (1)</span>
                    <span>Best Quality (50)</span>
                </div>
            </div>
            
            <div class="slider-container">
                <label for="guidance">Guidance Scale: <span id="guidanceValue" class="slider-value">2</span></label>
                <input type="range" id="guidance" min="2" max="10" value="2" step="0.5" onchange="updateGuidanceValue()">
                <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px; color: #999;">
                    <span>Creative (2)</span>
                    <span>Strict (10)</span>
                </div>
            </div>
            
            <div class="slider-container">
                <label for="size">Image Size:</label>
                <select id="size" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                    <optgroup label="Square (1:1)">
                        <option value="512x512">512×512</option>
                        <option value="768x768">768×768</option>
                        <option value="1024x1024" selected>1024×1024</option>
                    </optgroup>
                    <optgroup label="Landscape 16:9">
                        <option value="1920x1080">1920×1080 (Full HD)</option>
                        <option value="1600x900">1600×900</option>
                        <option value="1280x720">1280×720 (HD)</option>
                        <option value="1366x768">1366×768</option>
                        <option value="1024x576">1024×576</option>
                    </optgroup>
                    <optgroup label="Portrait 9:16">
                        <option value="1080x1920">1080×1920</option>
                        <option value="900x1600">900×1600</option>
                        <option value="720x1280">720×1280</option>
                        <option value="576x1024">576×1024</option>
                    </optgroup>
                    <optgroup label="Other Ratios">
                        <option value="1024x768">1024×768 (4:3)</option>
                        <option value="768x1024">768×1024 (3:4)</option>
                    </optgroup>
                </select>
            </div>
            
            <div class="slider-container">
                <label for="seed">Seed (optional):</label>
                <input type="number" id="seed" placeholder="Random seed for reproducibility" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
        </div>
        
        <div class="input-group">
            <label for="negative_prompt">Negative Prompt (optional):</label>
            <textarea id="negative_prompt" placeholder="What to avoid in the image..." style="min-height: 60px;"></textarea>
        </div>
        
        <button id="generateBtn" onclick="generateImage()">Generate Image</button>
        
        <div class="examples">
            <h3>Example Prompts:</h3>
            <div class="example-prompt" onclick="setPrompt('A majestic phoenix rising from flames, cinematic lighting, highly detailed feathers')">
                🔥 Majestic phoenix rising from flames
            </div>
            <div class="example-prompt" onclick="setPrompt('Cyberpunk city at night, neon lights, rain reflections, futuristic atmosphere')">
                🌃 Cyberpunk city at night
            </div>
            <div class="example-prompt" onclick="setPrompt('Portrait of a mystical forest guardian, ethereal glow, detailed fantasy art')">
                🧙 Mystical forest guardian
            </div>
            <div class="example-prompt" onclick="setPrompt('Underwater coral reef, vibrant colors, tropical fish, sunlight rays through water')">
                🐠 Underwater coral reef paradise
            </div>
        </div>
        
        <div class="loading" id="loading">
            <div class="spinner"></div>
            <p>Generating your image with Phoenix model...</p>
        </div>
        
        <div id="error" class="error"></div>
        <div id="result"></div>
    </div>

    <script>
        function updateStepsValue() {
            const steps = document.getElementById('steps').value;
            document.getElementById('stepsValue').textContent = steps;
        }
        
        function updateGuidanceValue() {
            const guidance = document.getElementById('guidance').value;
            document.getElementById('guidanceValue').textContent = guidance;
        }

        function setPrompt(text) {
            document.getElementById('prompt').value = text;
        }

        async function generateImage() {
            const prompt = document.getElementById('prompt').value;
            const num_steps = document.getElementById('steps').value;
            const guidance = document.getElementById('guidance').value;
            const sizeValue = document.getElementById('size').value;
            const [width, height] = sizeValue.split('x').map(Number);
            const seed = document.getElementById('seed').value;
            const negative_prompt = document.getElementById('negative_prompt').value;
            
            if (!prompt) {
                showError('Please enter a prompt');
                return;
            }

            document.getElementById('generateBtn').disabled = true;
            document.getElementById('loading').style.display = 'block';
            document.getElementById('result').innerHTML = '';
            hideError();

            try {
                const requestBody = { 
                    prompt,
                    num_steps: parseInt(num_steps),
                    guidance: parseFloat(guidance),
                    width: width,
                    height: height
                };
                
                if (seed) {
                    requestBody.seed = parseInt(seed);
                }
                
                if (negative_prompt) {
                    requestBody.negative_prompt = negative_prompt;
                }
                
                const response = await fetch('/phoenix', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to generate image');
                }

                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                
                document.getElementById('result').innerHTML = 
                    '<img src="' + imageUrl + '" alt="Generated image">';

            } catch (error) {
                showError('Error: ' + error.message);
            } finally {
                document.getElementById('generateBtn').disabled = false;
                document.getElementById('loading').style.display = 'none';
            }
        }

        function showError(message) {
            const errorDiv = document.getElementById('error');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }

        function hideError() {
            document.getElementById('error').style.display = 'none';
        }

        document.getElementById('prompt').addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generateImage();
            }
        });
    </script>
</body>
</html>
`;