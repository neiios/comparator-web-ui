export const examplePayload = `{
  "compare_item": {
    "id": "11111111-2222-3333-4444-555555555555",
    "created_date": "2025-01-01T00:00:00.000Z",
    "expected": {
      "success": {
        "price": {
          "currency": "USD",
          "discount": "0",
          "planPrice": "10.00",
          "singlePaymentUnlimited": true,
          "subtotal": "10.00",
          "total": "10.00"
        },
        "prices": [
          {
            "duration": {
              "cycleFrom": 1,
              "numberOfCycles": 1
            },
            "price": {
              "currency": "USD",
              "discount": "0",
              "proration": "0",
              "subtotal": "10.00",
              "total": "10.00"
            }
          }
        ]
      }
    },
    "actual": {
      "success": {
        "price": {
          "currency": "USD",
          "discount": "0",
          "freeTrialDays": 0,
          "planPrice": "10.00",
          "singlePaymentUnlimited": true,
          "subtotal": "10.00",
          "tax": {
            "amount": "0",
            "name": "TBD",
            "rate": "0"
          },
          "total": "10.00"
        },
        "prices": [
          {
            "duration": {
              "cycleFrom": 1,
              "numberOfCycles": 1
            },
            "price": {
              "currency": "USD",
              "discount": "0",
              "proration": "0",
              "subtotal": "10.00",
              "tax": {
                "amount": "0",
                "name": "TBD",
                "rate": "0"
              },
              "total": "10.00"
            }
          }
        ]
      }
    },
    "tag": "com.example.service.DiffExample",
    "request_id": "1234567890",
    "channel_name": "com_example_diff-tool",
    "result": {
      "status": "MISMATCH"
    },
    "tags": []
  }
}`.trim()

export const exampleConfiguration = `{
  "channel": {
    "id": "28d178b7-8088-46bb-8253-e816b1b3c1b6",
    "configuration": {
      "ignore_paths": [
        "success.price.tax",
        "success.price.freeTrialDays",
        "success.prices[*].price.tax"
      ]
    }
  }
}`.trim()
