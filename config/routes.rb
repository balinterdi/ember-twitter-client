EmberTwitterClient::Application.routes.draw do
  resource :user
  get '/user_info/:id' => 'user_info#show'
  resources :timelines, only: :show do
    get :home, on: :collection
  end

  root  to:   'home#index'
end
