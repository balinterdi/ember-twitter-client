class TimelinesController < ApplicationController
  respond_to :json

  def home
    response = api_get 'twitter/timelines/home.json'
    respond_with response.body
  end
end
