"""
haimtran
query api url from output of PreProdApplicationStack
then perform test with the api endppoint before
deploy production level.
"""

import boto3
import requests

STACK_NAME = "PreProdApplicationStack"
ENDPOINT = "book"

def query_api_url(stack_name):
    """
    query api url from cloudformation template output
    """

    # cloudformation client
    client = boto3.client('cloudformation')
    # query application stack
    resp = client.describe_stacks(
        StackName=stack_name
    )
    # looking for api url in stack output
    stack_outputs = resp['Stacks'][0]['Outputs']
    for output in stack_outputs:
        if output['OutputKey'] == 'UrlPreProd':
            api_url = output['OutputValue']
            print(f"api url: {api_url}")
    # return api url
    return api_url


def test_200_response():
    # get api url 
    api_url = query_api_url(STACK_NAME)
    # send request
    with requests.get(f"{api_url}/{ENDPOINT}") as response:
        print(response.text)
        assert response.status_code == 200


if __name__=="__main__":
    test_200_response()
