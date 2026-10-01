// Real responses from DeepSpace's YouTube integration, captured 2026-10-01 and trimmed to the fields we read.
// Search items have `id: { videoId }`, no length, and no `status`. Details accept several ids at once and add
// `contentDetails.duration`, but still no `status` (so embeddability is unknown from this source).
export const REAL_SEARCH_ITEM = {
  "id": {
    "kind": "youtube#video",
    "videoId": "bMZ1mI1g1rM"
  },
  "snippet": {
    "title": "10 minute Stress Relieving Stretch // Somatic Chair Yoga",
    "channelTitle": "SeniorShape Fitness",
    "thumbnails": {
      "medium": {
        "url": "https://i.ytimg.com/vi/bMZ1mI1g1rM/mqdefault.jpg",
        "width": 320,
        "height": 180
      }
    }
  },
  "links": {
    "watch": "https://www.youtube.com/watch?v=bMZ1mI1g1rM",
    "embed": "https://www.youtube.com/embed/bMZ1mI1g1rM",
    "thumbnail": "https://i.ytimg.com/vi/bMZ1mI1g1rM/mqdefault.jpg"
  }
} as const

export const REAL_DETAILS = [
  {
    "id": "bMZ1mI1g1rM",
    "snippet": {
      "title": "10 minute Stress Relieving Stretch // Somatic Chair Yoga",
      "channelTitle": "SeniorShape Fitness",
      "thumbnails": {
        "medium": {
          "url": "https://i.ytimg.com/vi/bMZ1mI1g1rM/mqdefault.jpg",
          "width": 320,
          "height": 180
        }
      }
    },
    "contentDetails": {
      "duration": "PT12M10S"
    },
    "links": {
      "watch": "https://www.youtube.com/watch?v=bMZ1mI1g1rM",
      "embed": "https://www.youtube.com/embed/bMZ1mI1g1rM",
      "thumbnail": "https://i.ytimg.com/vi/bMZ1mI1g1rM/mqdefault.jpg"
    }
  },
  {
    "id": "5LKPWQ3G8Aw",
    "snippet": {
      "title": "10 Minute Chair Yoga for Seniors | Day 2: Better Balance Program",
      "channelTitle": "Yes2Next",
      "thumbnails": {
        "medium": {
          "url": "https://i.ytimg.com/vi/5LKPWQ3G8Aw/mqdefault.jpg",
          "width": 320,
          "height": 180
        }
      }
    },
    "contentDetails": {
      "duration": "PT12M17S"
    },
    "links": {
      "watch": "https://www.youtube.com/watch?v=5LKPWQ3G8Aw",
      "embed": "https://www.youtube.com/embed/5LKPWQ3G8Aw",
      "thumbnail": "https://i.ytimg.com/vi/5LKPWQ3G8Aw/mqdefault.jpg"
    }
  }
] as const
