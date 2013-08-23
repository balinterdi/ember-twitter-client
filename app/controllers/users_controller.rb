class UsersController < ApplicationController
  respond_to :json

  def show
    response = api_get 'twitter/user.json'
    respond_with response.body
  end
end
