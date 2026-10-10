# Known limitations

- The three Cognito roles still need recorded browser evidence through the Amplify application. Backend authorization and negative API cases are verified, but they do not replace this final end-user proof.
- Read-only dashboard, event, and worker query routes are public for the hackathon demonstration. All reset, heat-spike, and callback mutations require Cognito JWT authorization and server-side identity mapping.
- The deployment is a single-hub demonstration, not a production multi-tenant service.
- Weather mode defaults to a cached, non-alert baseline. The labelled heat spike is simulated and visibly identified as such.
- Rest points and rider positions are seeded demonstration data.
- Exposure thresholds are demonstration policy and are not medical advice.
- Reset scans the small demo dataset by marker. A production system should partition reset/version data by tenant and hub.
- The product does not integrate with a real dispatch provider, push notification service, SMS/WhatsApp, or emergency services.
- CDK reports deprecation warnings for `logRetention` and Step Functions `timeout`; these are maintenance items and do not affect the verified deployment.
