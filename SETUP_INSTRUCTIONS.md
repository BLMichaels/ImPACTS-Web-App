# BigQuery Setup Instructions

## Step 1: Enable BigQuery API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your `impacts-tracker` project
3. Navigate to "APIs & Services" > "Library"
4. Search for "BigQuery API" and click "Enable"

## Step 2: Create Service Account

1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Fill in the details:
   - **Name**: `impacts-bigquery-service`
   - **Description**: `Service account for ImPACTS BigQuery integration`
4. Click "Create and Continue"

## Step 3: Grant Permissions

Add these roles to your service account:
- **BigQuery Data Editor** - Can create/modify datasets and tables
- **BigQuery Job User** - Can run queries
- **BigQuery Data Viewer** - Can read data

## Step 4: Generate Service Account Key

1. Click on your created service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose "JSON" format
5. Download the key file (save it securely!)

## Step 5: Create .env File

Create a `.env` file in your project root with the following content:

```env
# Firebase Configuration (for authentication only)
REACT_APP_FIREBASE_API_KEY=AIzaSyCRhd9Mr1QB5qWwU57_I7UoLmeW6egGSDI
REACT_APP_FIREBASE_AUTH_DOMAIN=impacts-tracker.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=impacts-tracker
REACT_APP_FIREBASE_STORAGE_BUCKET=impacts-tracker.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=936816429135
REACT_APP_FIREBASE_APP_ID=1:936816429135:web:07d8511644e90e042e823a
REACT_APP_FIREBASE_MEASUREMENT_ID=G-J02HGC65WX

# BigQuery Configuration
REACT_APP_BIGQUERY_PROJECT_ID=impacts-tracker
REACT_APP_BIGQUERY_DATASET_ID=impacts_data
REACT_APP_BIGQUERY_LOCATION=US
REACT_APP_BIGQUERY_CREDENTIALS={"impacts-bigquery-service@impacts-tracker.iam.gserviceaccount.com","private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDasK+rlihpUiUN\nzjmr2e6mU5RlcKvmXmoL8oZmHdkBM+zCFC9O/VPBafPoJdhY/nCFnctBnP44NGYI\no345phoBiNHTHYBbpcBDA+dl1MqOZjCzm9s3iarkqZDwWhMUTYImwnL2+8TOPTpf\nB0jXw3BqlSxMJWVsFFNQDjPw9d1NUaflAOez6ubJwee8jwHR3IXUbVEsu8W4Aj+F\nLyHogOJHwlx9iTaU1Zo9Y/YDbJZFxKyHJXXar0YAekLxT8P4rkTulsEvRU5mEKN+\nkEAu4DCue9eQXowf39oafQdbN3hhHH3lVBbvxGUhovYykjNNUjUZkkV03m0ci6yM\nnQ10AVeLAgMBAAECggEABDzkSpjwU4op+aiDaZchjsuT1ptmWWJ+/5hFjnkJmYJe\nFiy59ffmxZq+BUOme6MCnzQ9mhnmu0QYrhYs/gUAAAOcvVCXCi+eGC5dL5X+DuBg\nFTrx9pOOYjv++Qll0UDnQsUF4U9jsvNwzCKiALxi003su9UFsCB8tNJxozvAfB0N\nx7W5jePdzysdA4fQWhjJpra6sQ58Vb64h4r8hrayKIdHaERXOlUJx0EtBIS1ac6P\nvLXSvBGa4KpnDnpgfYVtBR9HqwvuTkiMaloJ+02TLya/ny2/49bGtoZra2LSZspk\nKoq+scPQvLc4l4WrNgrw1IWk9Q5IuFYrVzKB3Gu1cQKBgQD+7O+gp+TVeheTEctx\nJHHlK4q8KranL0welFRNJYM8JTWhkDVq+Wb2mghoUt2yPx113kYwp/zxZ9c/mZHv\n8AAkh7jhtRHLBN6a07qw0TbXyrfC8x7H9yGtpkWrs318Ys+4EX4YaPscu7OA5ASt\nhfTygcT8CXP6qg/Q9vJMYOf6nQKBgQDbnKb+jsLNX5r5bOpKjCDm6IGK+OnT56RV\ns0U/qCL3UwqGm/EgIgfQVCXhNApErY/sOUnQTnIJ9YGbjkfp0xQDqvBCLuSgXP3i\n/jHQZ9Ri0nGuoc95qM9l15DeUJj4CjwM/zFCjlflhPx/o5CZl1vf7fryme5SeSh4\niZpqNdtORwKBgDFJoB8AtxarL2mo9Bug/0BexckRvRTf6Si0ZwQvb4suaosdNabE\nJ6sgJuX8t45h85E5c3qu0BHgkNZkG7o3Pd/SOeWxu4n0HBH1Q9Ax8xePwy23Ecl5\nt5I6ZpgG8QkelaiyAR45Fev9Qnx2GY1vK+fDPVG5hin9vWcah8hKqC9lAoGAUB/0\nkbW2f0Xdfhlt1esQag70jKbKcUT3oUj6AAKxVzlWAszMiePApBK/i034XRxSAWbZ\ndoXYd6e6NO4RcM9RYxEv/YWsZpHnE7WYqSfoxnFvhr6EuyeLG+Ytdd9EIGNji35k\nE5tpmFUP5uXfcRpXK/lg8LiWykJoMKpLy2qA7CsCgYEAxpq8krQGaF1t+/PpJYkM\n1eRA3jW0JZMyzzaQIxVNNgibH/0Lr9G+MlpAFTPUuZ0p/cJpZzLi71uCqDJS2n2Q\npK0NQotunX1PvULbCp6C7qUWdvMd2JVxjAobiCyR3V7YeSit47FBPWD5hCPQfMWc\nGFpgHkzCA3ORyOJ0E7SYvzo=\n-----END PRIVATE KEY-----\n"}

# Optional: Development flags
REACT_APP_ENVIRONMENT=development
REACT_APP_DEBUG_MODE=true
```

## Step 6: Update BigQuery Credentials

From your downloaded service account JSON file, copy:
1. **client_email** - Replace `your-service-account@impacts-tracker.iam.gserviceaccount.com`
2. **private_key** - Replace `YOUR_PRIVATE_KEY_HERE` (keep the quotes and newlines)

## Step 7: Test the Connection

Run the test script:
```bash
npm run setup-bigquery
```

## Step 8: Start Your App

```bash
cd client
npm start
```

## Troubleshooting

### Common Issues:

1. **"BigQuery API not enabled"**
   - Make sure you've enabled the BigQuery API in Google Cloud Console

2. **"Permission denied"**
   - Check that your service account has the required roles
   - Verify the project ID is correct

3. **"Invalid credentials"**
   - Double-check the JSON format in REACT_APP_BIGQUERY_CREDENTIALS
   - Make sure the private key includes the full key with newlines

4. **"Dataset not found"**
   - The dataset will be created automatically on first use
   - This is normal and expected

## Security Notes

- Never commit your `.env` file to version control
- Keep your service account key file secure
- Consider using environment-specific service accounts for production
