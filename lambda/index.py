"""
simple lambda 
"""

import json


def handler(event, context):
    """
    lambda handler
    """
    return {
        'statusCode': 200,
        'headers': {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,GET"
        },
        'body': json.dumps({
            'message': f"{event}"
        })
    }
