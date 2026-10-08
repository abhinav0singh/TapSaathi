# Known limitations

- This is a public demonstration environment unless a frontend owner adds the P1 Cognito layer. It is not production access control.
- Weather mode defaults to a cached, non-alert baseline for reliable scheduled execution. `WEATHER_MODE=live` uses Open-Meteo current conditions but does not infer an official alert from temperature alone.
- Rest points and rider positions are seeded demonstration data and are visibly marked simulated.
- Operational exposure thresholds are configurable demo policy, not medical advice.
- The Amazon Location fallback is straight-line selection only and is labelled unavailable; it is never represented as an AWS-calculated route.
- Reset scans the small single-hub demo partition by marker. A production multi-tenant system would use a dedicated hub-generation partitioning strategy.
- Authentication, push notifications, real dispatch integration, real SMS/WhatsApp, and emergency calling are outside P0 scope.
