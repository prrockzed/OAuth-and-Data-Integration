# hubspot.py

import json
import secrets
from fastapi import Request, HTTPException
from fastapi.responses import HTMLResponse
import httpx
import asyncio
import base64
import requests
from integrations.integration_item import IntegrationItem

from redis_client import add_key_value_redis, get_value_redis, delete_key_redis

CLIENT_ID = 'XXX'
CLIENT_SECRET = 'XXX'

REDIRECT_URI = 'http://localhost:8000/integrations/hubspot/oauth2callback'
SCOPES = 'contacts content files forms automation marketing emails'
authorization_url = f'https://app.hubspot.com/oauth/authorize?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&scope={SCOPES}'

async def authorize_hubspot(user_id, org_id):
    state_data = {
        'state': secrets.token_urlsafe(32),
        'user_id': user_id,
        'org_id': org_id
    }
    encoded_state = json.dumps(state_data)
    
    await add_key_value_redis(f'hubspot_state:{org_id}:{user_id}', encoded_state, expire=600)
    
    return f'{authorization_url}&state={encoded_state}'

async def oauth2callback_hubspot(request: Request):
    if request.query_params.get('error'):
        raise HTTPException(status_code=400, detail=request.query_params.get('error'))
    
    code = request.query_params.get('code')
    encoded_state = request.query_params.get('state')
    state_data = json.loads(encoded_state)
    
    original_state = state_data.get('state')
    user_id = state_data.get('user_id')
    org_id = state_data.get('org_id')
    
    saved_state = await get_value_redis(f'hubspot_state:{org_id}:{user_id}')
    
    if not saved_state or original_state != json.loads(saved_state).get('state'):
        raise HTTPException(status_code=400, detail='State does not match.')
    
    async with httpx.AsyncClient() as client:
        response, _ = await asyncio.gather(
            client.post(
                'https://api.hubapi.com/oauth/v1/token',
                data={
                    'grant_type': 'authorization_code',
                    'client_id': CLIENT_ID,
                    'client_secret': CLIENT_SECRET,
                    'redirect_uri': REDIRECT_URI,
                    'code': code
                },
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            ),
            delete_key_redis(f'hubspot_state:{org_id}:{user_id}'),
        )
    
    response_data = response.json()
    await add_key_value_redis(f'hubspot_credentials:{org_id}:{user_id}', 
                            json.dumps(response_data), 
                            expire=response_data.get('expires_in', 3600))
    
    close_window_script = """ 
    <html>
    <script>
        window.close();
    </script>
    </html>
    """
    
    return HTMLResponse(content=close_window_script)

async def get_hubspot_credentials(user_id, org_id):
    credentials = await get_value_redis(f'hubspot_credentials:{org_id}:{user_id}')
    if not credentials:
        raise HTTPException(status_code=400, detail='No credentials found.')
    credentials = json.loads(credentials)
    await delete_key_redis(f'hubspot_credentials:{org_id}:{user_id}')
    return credentials

def create_integration_item_metadata_object(item_data, item_type):
    return IntegrationItem(
        id=item_data.get('id'),
        type=item_type,
        name=item_data.get('name', item_data.get('properties', {}).get('firstname', '') + ' ' + item_data.get('properties', {}).get('lastname', '')),
        creation_time=item_data.get('createdAt'),
        last_modified_time=item_data.get('updatedAt'),
        url=item_data.get('url'),
    )

async def get_items_hubspot(credentials):
    """Aggregates all metadata relevant for a HubSpot integration"""
    credentials = json.loads(credentials)
    access_token = credentials.get('access_token')
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    list_of_integration_item_metadata = []
    
    # Get contacts
    contacts_response = requests.get(
        'https://api.hubapi.com/crm/v3/objects/contacts',
        headers=headers
    )
    
    if contacts_response.status_code == 200:
        for contact in contacts_response.json().get('results', []):
            list_of_integration_item_metadata.append(
                create_integration_item_metadata_object(contact, 'Contact')
            )
    
    # Get companies
    companies_response = requests.get(
        'https://api.hubapi.com/crm/v3/objects/companies',
        headers=headers
    )
    
    if companies_response.status_code == 200:
        for company in companies_response.json().get('results', []):
            list_of_integration_item_metadata.append(
                create_integration_item_metadata_object(company, 'Company')
            )
    
    deals_response = requests.get(
        'https://api.hubapi.com/crm/v3/objects/deals',
        headers=headers
    )
    
    if deals_response.status_code == 200:
        for deal in deals_response.json().get('results', []):
            list_of_integration_item_metadata.append(
                create_integration_item_metadata_object(deal, 'Deal')
            )
    
    print(f'HubSpot items: {list_of_integration_item_metadata}')
    return list_of_integration_item_metadata
