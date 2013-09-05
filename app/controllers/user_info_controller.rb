class UserInfoController < ApplicationController
  respond_to :json

  def show
    response = api_get "/twitter/users/#{params[:id]}.json"
    respond_with response.body
  end
end
