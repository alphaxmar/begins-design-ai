# AI Image Generation API

API สำหรับสร้างภาพด้วย AI โดยใช้ FLUX และ Phoenix models

## Base URL
```
https://flux-image-generator.example.workers.dev
```

## API Documentation
- **เอกสาร API แบบเต็ม:** https://flux-image-generator.example.workers.dev/api

## Available Models

### 🚀 FLUX-1-schnell (Fast)
- **Speed:** 2-3 วินาที
- **Quality:** ดี
- **Output:** PNG
- **Use case:** Quick iterations, real-time apps

### 🎨 Phoenix 1.0 (Quality)  
- **Speed:** 3-5 วินาที
- **Quality:** สูงมาก
- **Output:** JPEG
- **Use case:** Professional, artistic work

## Endpoints

### 1. API Information
```
GET /api/info
```

### 2. FLUX Model (Fast)
```
POST /api/flux
```

### 3. Phoenix Model (Quality)
```
POST /api/phoenix
```

### 4. Web Interfaces
- **FLUX UI:** https://flux-image-generator.example.workers.dev/
- **Phoenix UI:** https://flux-image-generator.example.workers.dev/phoenix

## FLUX Model API

### Request Format
```json
{
  "prompt": "A beautiful sunset over mountains",
  "steps": 4,
  "aspectRatio": "1:1"
}
```

### Parameters

| Parameter | Type | Required | Default | Options |
|-----------|------|----------|---------|---------|
| `prompt` | string | Yes | - | Any text description |
| `steps` | number | No | 4 | 1-8 |
| `aspectRatio` | string | No | "1:1" | "1:1", "16:9", "9:16", "4:3", "3:4" |

## Phoenix Model API

### Request Format
```json
{
  "prompt": "A majestic phoenix rising from flames",
  "num_steps": 25,
  "guidance": 2,
  "width": 1024,
  "height": 1024,
  "seed": 42,
  "negative_prompt": "blurry, low quality"
}
```

### Parameters

| Parameter | Type | Required | Default | Options |
|-----------|------|----------|---------|---------|
| `prompt` | string | Yes | - | Any text description |
| `num_steps` | number | No | 25 | 1-50 |
| `guidance` | number | No | 2 | 2-10 (higher = more prompt adherence) |
| `width` | number | No | 1024 | Up to 2048 pixels |
| `height` | number | No | 1024 | Up to 2048 pixels |
| `seed` | number | No | random | Integer for reproducible results |
| `negative_prompt` | string | No | - | What to exclude from image |

## Response

### FLUX Model Response
- **Content-Type**: `image/png`
- **Status**: 200 OK
- **Body**: PNG image data (binary)

#### Response Headers
```
Content-Type: image/png
X-Model: flux-1-schnell
X-Steps: 4
X-Width: 1024
X-Height: 1024
```

### Phoenix Model Response
- **Content-Type**: `image/jpeg`
- **Status**: 200 OK  
- **Body**: JPEG image data (binary)

#### Response Headers
```
Content-Type: image/jpeg
X-Model: phoenix-1.0
X-Steps: 25
X-Guidance: 2
X-Width: 1024
X-Height: 1024
```

## Example Usage

### API Info
```bash
curl -s https://flux-image-generator.example.workers.dev/api/info | jq .
```

### FLUX Model (Fast)
```bash
curl -X POST https://flux-image-generator.example.workers.dev/api/flux \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a cat wearing sunglasses", "steps": 4, "aspectRatio": "16:9"}' \
  --output flux_image.png
```

### Phoenix Model (Quality)
```bash
curl -X POST https://flux-image-generator.example.workers.dev/api/phoenix \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a majestic phoenix rising from flames, highly detailed",
    "num_steps": 30,
    "guidance": 7.5,
    "width": 1920,
    "height": 1080,
    "negative_prompt": "blurry, low quality, distorted"
  }' \
  --output phoenix_image.jpg
```

### Python Examples

#### FLUX Model
```python
import requests

# Fast generation with FLUX
flux_url = "https://flux-image-generator.example.workers.dev/api/flux"
flux_data = {
    "prompt": "a cat wearing sunglasses",
    "steps": 4,
    "aspectRatio": "16:9"
}

response = requests.post(flux_url, json=flux_data)

if response.status_code == 200:
    with open("flux_image.png", "wb") as f:
        f.write(response.content)
    
    print(f"FLUX Model: {response.headers.get('X-Model')}")
    print(f"Steps: {response.headers.get('X-Steps')}")
    print(f"Size: {response.headers.get('X-Width')}x{response.headers.get('X-Height')}")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

#### Phoenix Model
```python
import requests

# High-quality generation with Phoenix
phoenix_url = "https://flux-image-generator.example.workers.dev/api/phoenix"
phoenix_data = {
    "prompt": "a majestic phoenix rising from flames, highly detailed",
    "num_steps": 30,
    "guidance": 7.5,
    "width": 1920,
    "height": 1080,
    "negative_prompt": "blurry, low quality, distorted"
}

response = requests.post(phoenix_url, json=phoenix_data)

if response.status_code == 200:
    with open("phoenix_image.jpg", "wb") as f:
        f.write(response.content)
    
    print(f"Phoenix Model: {response.headers.get('X-Model')}")
    print(f"Steps: {response.headers.get('X-Steps')}")
    print(f"Guidance: {response.headers.get('X-Guidance')}")
    print(f"Size: {response.headers.get('X-Width')}x{response.headers.get('X-Height')}")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

### JavaScript/Node.js

#### FLUX Model
```javascript
const fetch = require('node-fetch');
const fs = require('fs');

async function generateFluxImage() {
    const response = await fetch('https://flux-image-generator.example.workers.dev/api/flux', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: "a cat wearing sunglasses",
            steps: 4,
            aspectRatio: "16:9"
        })
    });

    if (response.ok) {
        const buffer = await response.buffer();
        fs.writeFileSync('flux_image.png', buffer);
        
        console.log('Model:', response.headers.get('X-Model'));
        console.log('Steps:', response.headers.get('X-Steps'));
        console.log('Size:', `${response.headers.get('X-Width')}x${response.headers.get('X-Height')}`);
    } else {
        console.error('Error:', await response.text());
    }
}

generateFluxImage();
```

#### Phoenix Model
```javascript
const fetch = require('node-fetch');
const fs = require('fs');

async function generatePhoenixImage() {
    const response = await fetch('https://flux-image-generator.example.workers.dev/api/phoenix', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: "a majestic phoenix rising from flames",
            num_steps: 30,
            guidance: 7.5,
            width: 1920,
            height: 1080,
            negative_prompt: "blurry, low quality"
        })
    });

    if (response.ok) {
        const buffer = await response.buffer();
        fs.writeFileSync('phoenix_image.jpg', buffer);
        
        console.log('Model:', response.headers.get('X-Model'));
        console.log('Steps:', response.headers.get('X-Steps'));
        console.log('Guidance:', response.headers.get('X-Guidance'));
        console.log('Size:', `${response.headers.get('X-Width')}x${response.headers.get('X-Height')}`);
    } else {
        console.error('Error:', await response.text());
    }
}

generatePhoenixImage();
```

### Bulk Generation (Python)

```python
import requests
import threading
from concurrent.futures import ThreadPoolExecutor
import os

def generate_single_image(prompt, image_id, model="flux", output_dir="images"):
    """Generate single image with error handling"""
    try:
        if model == "flux":
            url = "https://flux-image-generator.example.workers.dev/api/flux"
            data = {"prompt": prompt, "steps": 4, "aspectRatio": "1:1"}
            ext = "png"
        else:  # phoenix
            url = "https://flux-image-generator.example.workers.dev/api/phoenix"
            data = {"prompt": prompt, "num_steps": 25, "guidance": 2}
            ext = "jpg"
            
        response = requests.post(url, json=data, timeout=60)
        
        if response.status_code == 200:
            os.makedirs(output_dir, exist_ok=True)
            filename = f"{output_dir}/{model}_image_{image_id:03d}.{ext}"
            
            with open(filename, 'wb') as f:
                f.write(response.content)
            
            size = len(response.content) / 1024  # KB
            model_name = response.headers.get('X-Model', model)
            
            print(f"✅ Image {image_id}: {filename} ({model_name}, {size:.0f}KB)")
            return {"success": True, "filename": filename, "model": model_name}
        else:
            print(f"❌ Image {image_id}: Failed - {response.status_code}")
            return {"success": False, "error": response.text}
            
    except Exception as e:
        print(f"💥 Image {image_id}: Exception - {e}")
        return {"success": False, "error": str(e)}

def generate_bulk_images(prompts, max_workers=5):
    """Generate multiple images concurrently"""
    print(f"🚀 Starting bulk generation of {len(prompts)} images...")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(generate_single_image, prompt, i+1) 
            for i, prompt in enumerate(prompts)
        ]
        
        results = [future.result() for future in futures]
    
    successful = [r for r in results if r.get("success")]
    failed = [r for r in results if not r.get("success")]
    
    print(f"✅ Successful: {len(successful)}/{len(prompts)}")
    print(f"❌ Failed: {len(failed)}")
    
    return results

# Example usage - Mixed models
prompts = [
    ("a beautiful sunset over mountains", "flux"),
    ("a cute cat in a garden", "flux"), 
    ("futuristic city with flying cars", "phoenix"),
    ("abstract geometric art", "phoenix"),
    ("vintage car on countryside road", "flux")
]

# Generate with different models
for i, (prompt, model) in enumerate(prompts):
    generate_single_image(prompt, i+1, model=model)
```

### PHP

```php
<?php
$url = 'https://flux-image-generator.xxxx.workers.dev';
$data = json_encode([
    'prompt' => 'a cat wearing sunglasses',
    'steps' => 4,
    'aspectRatio' => '1:1'
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);

$response = curl_exec($ch);
$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$headers = substr($response, 0, $header_size);
$body = substr($response, $header_size);

if (curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200) {
    file_put_contents('generated_image.png', $body);
    
    // Extract cost from headers
    preg_match('/X-Cost-THB: ([\d.]+)/', $headers, $matches);
    echo "Cost: " . ($matches[1] ?? 'unknown') . " THB\n";
} else {
    echo "Error: " . $body . "\n";
}

curl_close($ch);
?>
```

## Error Responses

### 400 Bad Request

```json
{
  "error": "Prompt is required"
}
```

### 500 Internal Server Error

```json
{
  "error": "Authentication error",
  "stack": "..."
}
```

## Performance & Comparison

### Model Comparison

| Feature | FLUX-1-schnell | Phoenix 1.0 |
|---------|----------------|-------------|
| **Speed** | 2-3 seconds | 3-5 seconds |
| **Quality** | Good | Excellent |
| **Max Steps** | 1-8 | 1-50 |
| **Output Format** | PNG | JPEG |
| **Max Resolution** | 1344×768 | 2048×2048 |
| **Special Features** | Aspect ratios | Guidance, negative prompts, seeds |
| **Best For** | Quick iterations | Final artwork |

### Performance Metrics

- **Rate Limit**: No hard limits currently
- **Recommended Concurrent**: Up to 10 requests
- **FLUX Generation Time**: 2-3 seconds average
- **Phoenix Generation Time**: 3-5 seconds average
- **Success Rate**: 99%+ under normal load

### Recommended Image Sizes

#### FLUX Model (16:9 options)
| Aspect Ratio | Dimensions | Use Case |
|--------------|------------|----------|
| 1:1 | 1024×1024 | Avatars, social posts |
| 16:9 | 1344×768 | Banners, thumbnails |
| 9:16 | 768×1344 | Stories, mobile |
| 4:3 | 1024×768 | Classic format |

#### Phoenix Model (Custom sizes)
| Use Case | Dimensions | Description |
|----------|------------|-------------|
| Avatar | 512×512 | Profile pictures |
| HD Display | 1920×1080 | Full HD content |
| 4K Display | 2048×1152 | High resolution |
| Print Quality | 2048×2048 | Maximum quality |

### Best Practices

1. **Choose the right model:**
   - Use FLUX for prototyping and quick iterations
   - Use Phoenix for final, high-quality outputs

2. **Optimize parameters:**
   - Start with fewer steps and increase if needed
   - Use guidance 2-5 for natural results, 7-10 for strict adherence

3. **Batch processing:**
   - Process multiple images concurrently (max 5-10)
   - Use different prompts to avoid cache issues

4. **Error handling:**
   - Implement retry logic with exponential backoff
   - Check response status codes before processing
