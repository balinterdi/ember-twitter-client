class ApplicationController < ActionController::Base
  # Prevent CSRF attacks by raising an exception.
  # For APIs, you may want to use :null_session instead.
  protect_from_forgery with: :exception

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
    oauth_token = request.headers['X-OAuth-Token']
    api.get(url, params, { 'X-OAuth-Token' => oauth_token })
  end

  def api_base
    "http://localhost:3000"
  end
end
