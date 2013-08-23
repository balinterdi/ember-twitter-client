Rails.application.config.middleware.use OmniAuth::Builder do
  provider :twitter, ENV['QUIPPER_CONSUMER_KEY'], ENV['QUIPPER_CONSUMER_SECRET']
end
