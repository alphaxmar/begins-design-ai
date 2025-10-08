# FLUX Image Generation API Documentation

> Fast and affordable text-to-image generation using Cloudflare Workers AI

## 🚀 Quick Start

**Endpoint:** `https://flux-image-generator.example.workers.dev`

**Simple Example:**
```bash
curl -X POST https://flux-image-generator.example.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a beautiful sunset"}' \
  -o image.png
```

## 📋 API Reference

### Request

**Method:** `POST /`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "prompt": "your image description here",
  "steps": 4,
  "aspectRatio": "1:1"
}
```

### Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `prompt` | string | ✅ Yes | - | Text description of the image to generate |
| `steps` | number | ❌ No | `4` | Generation steps (1-8). Higher = better quality but slower |
| `aspectRatio` | string | ❌ No | `"1:1"` | Image aspect ratio |

**Aspect Ratio Options:**
- `"1:1"` - Square (1024×1024)
- `"16:9"` - Landscape (1344×768) 
- `"9:16"` - Portrait (768×1344)
- `"4:3"` - Classic landscape (1024×768)
- `"3:4"` - Classic portrait (768×1024)

### Response

**Success (200 OK):**
- **Content-Type:** `image/png`
- **Body:** PNG image binary data

**Headers:**
```
X-Cost-USD: 0.000652        # Cost in US dollars
X-Cost-THB: 0.0228          # Cost in Thai baht
X-Neurons-Used: 57.6        # AI processing units used
X-Image-Width: 1024         # Generated image width
X-Image-Height: 1024        # Generated image height
X-Steps: 4                  # Steps used for generation
X-Tiles: 4                  # Number of 512x512 tiles processed
```

**Error (400/500):**
```json
{
  "error": "Error description"
}
```

## 💻 Code Examples

### Python
```python
import requests

def generate_image(prompt, steps=4, aspect_ratio="1:1"):
    url = "https://flux-image-generator.example.workers.dev"
    
    response = requests.post(url, json={
        "prompt": prompt,
        "steps": steps,
        "aspectRatio": aspect_ratio
    })
    
    if response.status_code == 200:
        # Save image
        with open("generated.png", "wb") as f:
            f.write(response.content)
        
        # Get cost info
        cost = response.headers.get('X-Cost-THB')
        print(f"Generated! Cost: {cost} บาท")
        return True
    else:
        print(f"Error: {response.json()}")
        return False

# Usage
generate_image("a cute cat wearing a hat", steps=6, aspect_ratio="16:9")
```

### JavaScript (Node.js)
```javascript
const fetch = require('node-fetch');
const fs = require('fs');

async function generateImage(prompt, steps = 4, aspectRatio = "1:1") {
    try {
        const response = await fetch('https://flux-image-generator.example.workers.dev', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, steps, aspectRatio })
        });

        if (response.ok) {
            const buffer = await response.buffer();
            fs.writeFileSync('generated.png', buffer);
            
            console.log(`Cost: ${response.headers.get('X-Cost-THB')} บาท`);
            console.log(`Size: ${response.headers.get('X-Image-Width')}×${response.headers.get('X-Image-Height')}`);
            return buffer;
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (err) {
        console.error('Generation failed:', err.message);
        return null;
    }
}

// Usage
generateImage("futuristic city at night", 6, "16:9");
```

### JavaScript (Browser)
```javascript
async function generateImage(prompt) {
    try {
        const response = await fetch('https://flux-image-generator.example.workers.dev', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: prompt,
                steps: 4,
                aspectRatio: "1:1" 
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            
            // Display image
            const img = document.createElement('img');
            img.src = imageUrl;
            document.body.appendChild(img);
            
            // Show cost
            const cost = response.headers.get('X-Cost-THB');
            console.log(`Cost: ${cost} บาท`);
        } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
        }
    } catch (err) {
        console.error('Failed:', err);
    }
}
```

### PHP
```php
<?php
function generateImage($prompt, $steps = 4, $aspectRatio = "1:1") {
    $url = 'https://flux-image-generator.example.workers.dev';
    $data = json_encode([
        'prompt' => $prompt,
        'steps' => $steps,
        'aspectRatio' => $aspectRatio
    ]);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $data,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true
    ]);

    $response = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headers = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        file_put_contents('generated.png', $body);
        
        preg_match('/X-Cost-THB: ([\d.]+)/', $headers, $matches);
        $cost = $matches[1] ?? 'unknown';
        echo "Image generated! Cost: {$cost} บาท\n";
        return true;
    } else {
        echo "Error: {$body}\n";
        return false;
    }
}

// Usage
generateImage("a dragon flying over mountains", 6, "16:9");
?>
```

## 💰 Pricing

| Component | Price | Description |
|-----------|-------|-------------|
| **Per Tile** | $0.000053 | Each 512×512 image tile |
| **Per Step** | $0.00011 | Each generation step |

**Typical Costs:**
- **1:1 (Square):** ~0.023 บาท per image
- **16:9 (Landscape):** ~0.027 บาท per image  
- **9:16 (Portrait):** ~0.027 บาท per image

**Bulk Generation:**
- 10 images: ~0.23-0.27 บาท
- 100 images: ~2.3-2.7 บาท

## ⚡ Performance

- **Generation Time:** 3-10 seconds per image
- **Rate Limit:** 720 requests/minute
- **Concurrent Requests:** Supported
- **Image Quality:** High (1024+ pixels)

## 🛠️ Integration Tips

### For Video Applications
```python
def generate_video_frames(prompts, aspect_ratio="16:9"):
    """Generate multiple frames for video"""
    frames = []
    total_cost = 0
    
    for i, prompt in enumerate(prompts):
        print(f"Generating frame {i+1}/{len(prompts)}: {prompt}")
        
        response = requests.post(
            "https://flux-image-generator.example.workers.dev",
            json={"prompt": prompt, "aspectRatio": aspect_ratio}
        )
        
        if response.status_code == 200:
            frame_data = response.content
            frames.append(frame_data)
            
            cost = float(response.headers.get('X-Cost-THB', 0))
            total_cost += cost
            
            # Save individual frame
            with open(f"frame_{i:04d}.png", "wb") as f:
                f.write(frame_data)
        else:
            print(f"Failed to generate frame {i+1}")
    
    print(f"Generated {len(frames)} frames. Total cost: {total_cost:.2f} บาท")
    return frames

# Usage for video
prompts = [
    "a cat sitting in a garden, morning light",
    "a cat standing up in a garden, morning light", 
    "a cat walking in a garden, morning light"
]
frames = generate_video_frames(prompts)
```

### Error Handling
```python
import time
import requests

def generate_with_retry(prompt, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.post(
                "https://flux-image-generator.example.workers.dev",
                json={"prompt": prompt},
                timeout=30
            )
            
            if response.status_code == 200:
                return response.content
            elif response.status_code == 429:  # Rate limited
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"Rate limited. Waiting {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"Error {response.status_code}: {response.text}")
                
        except requests.RequestException as e:
            print(f"Request failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2)
    
    return None
```

## 🚫 Error Codes

| Status | Error | Solution |
|--------|-------|----------|
| 400 | "Prompt is required" | Include `prompt` in request body |
| 500 | "Authentication error" | Check if Workers AI is enabled |
| 429 | Rate limited | Wait and retry |
| 500 | "Failed to generate image" | Retry with different prompt |

## 📞 Support

- **GitHub Issues:** [Report bugs](https://github.com/your-repo/issues)
- **API Status:** Check if service is running at the endpoint
- **Rate Limits:** 720 requests/minute per IP

---

**Built with Cloudflare Workers AI & FLUX-1-schnell**