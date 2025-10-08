# FLUX-1-schnell Image Generator

A Cloudflare Worker that generates images using the FLUX-1-schnell AI model.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your Cloudflare account:
```bash
npx wrangler login
```

3. Run locally:
```bash
npm run dev
```

4. Deploy to Cloudflare:
```bash
npm run deploy
```

## Usage

- Open the worker URL in your browser
- Enter a text prompt describing the image you want to generate
- Click "Generate Image" or press Enter
- The AI will generate an image based on your prompt

## Features

- Web interface for easy image generation
- FLUX-1-schnell model integration
- CORS enabled for API usage
- Error handling and loading states

## API Usage

POST request to your worker URL:
```json
{
  "prompt": "A beautiful sunset over mountains"
}
```

Response: PNG image data