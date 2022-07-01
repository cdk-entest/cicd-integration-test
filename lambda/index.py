"""
simple lambda 
"""

import json


def handler(event, context):
    """
    lambda handler
    """
    return json.dumps({
        "message": "Hello Swin Devops"
    })
