---
name: Silence alert policy
description: Silence alone must never become a vehicle-battery disconnect alert
---
Rule: a "device went silent" condition must not create a vehicle-battery disconnect alert. Silence can mean GSM loss, tracker sleep, a device fault, or cut wiring; keep connectivity/offline state separate. Generic `alarm:*` names are not electrical feedback either. Only an explicit electrical tracker signal such as `powerCut:true` or `externalPower:false` may create the battery alert.

**Why:** idle devices repeatedly triggered false "power disconnected" notifications every idle period, followed by false "restored" alerts, in an endless loop; the owner considered this unprofessional.

**How to apply:** never convert absence of data or a generic alarm label into `power_disconnected`. Continue to use packet timestamps for Online/Offline and preserve explicit electrical telemetry as the only battery-alert input. Any future hardware-specific signal must be validated against real device payloads before enabling it.
