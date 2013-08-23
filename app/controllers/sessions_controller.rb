class SessionsController < ApplicationController
  skip_before_filter :initiate_session

  def create
    response = create_user
    session[:current_user_id] = response.body['id']
    redirect_to root_path
  end

  private

  def create_user
    api.post '/users.json', user_attributes
  end

  def user_attributes
    info = auth_hash.info
    creds = auth_hash.credentials
    {
      oauth_token: creds.token,
      oauth_token_secret: creds.secret,
      nickname: info.nickname,
      name: info.name,
      avatar_url: info.image,
      location: info.location,
      website: info.urls.Website,
      description: info.description
    }
  end

  def auth_hash
    request.env['omniauth.auth']
  end

end
