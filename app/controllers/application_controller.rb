class ApplicationController < ActionController::Base
  # Prevent CSRF attacks by raising an exception.
  # For APIs, you may want to use :null_session instead.
  protect_from_forgery with: :exception

  before_filter :initiate_session

  def initiate_session
    unless session[:current_user_id]
      redirect_to new_session_path
    end
  end

  #TODO: Delete me
  def current_user
    if session[:current_user_id]
      user = api.get "/users/#{session[:current_user_id]}"
    end
  end

  def api
    @api ||= Faraday.new(url: api_base) do |conn|
      conn.request  :multipart
      conn.request  :url_encoded
      conn.request  :json

      conn.response :logger
      conn.response :json

      conn.adapter Faraday.default_adapter
    end
  end

  def api_get(url, params={})
    api.get url, params.merge(user_id: session[:current_user_id])
  end

  def api_base
    # "http://ember-twitter-api.dev/"
    "http://localhost:3000"
  end
end
