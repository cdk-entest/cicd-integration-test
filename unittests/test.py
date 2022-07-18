import boto3
import requests

# api url
api_url = None
# endpoint wanted to test
endpoint = "book"
# application stack
stack_name = 'ApplicationStack'
# cloudformation client
client = boto3.client('cloudformation')
# query application stack
resp = client.describe_stacks(
    StackName=stack_name
)
# looking for api url in stack output
stack_outputs = resp['Stacks'][0]['Outputs']
for output in stack_outputs:
    if (output['OutputKey'] == 'Url'):
        api_url = output['OutputValue']
        print(f"api url: {api_url}")
# test an endpoint


def test_200_response():
    with requests.get(f"{api_url}/{endpoint}") as response:
        assert response.status_code == 200
