export type ReviewStatus = 'needs_review' | 'confirmed_fraud' | 'false_alarm'
export type Reviews = Record<string, ReviewStatus>

function key(batchHash: string, modelVersion: string) { return `signal-reviews:v1:${modelVersion}:${batchHash}` }

export function loadReviews(batchHash: string, modelVersion: string): Reviews {
  try {
    const data = JSON.parse(localStorage.getItem(key(batchHash, modelVersion)) || '{}')
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch { return {} }
}

export function saveReviews(batchHash: string, modelVersion: string, reviews: Reviews) { localStorage.setItem(key(batchHash, modelVersion), JSON.stringify(reviews)) }
export function resetReviews(batchHash: string, modelVersion: string) { localStorage.removeItem(key(batchHash, modelVersion)) }
