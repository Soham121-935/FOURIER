const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
const key = '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';

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`
  },
  body: JSON.stringify({
    model: 'meta/llama-3.3-70b-instruct',
    messages: [
      { role: 'user', content: 'hi' }
    ]
  })
})
.then(res => res.json())
.then(console.log)
.catch(console.error);
