require 'sinatra'
require 'sinatra/contrib'

require 'json'
require 'neography'
require 'set'

class Cluster
  attr_reader :nodes, :types, :url, :last_updated

  def initialize(url)
    @url = url
    @neo = Neography::Rest.new(url)
    update
  end
 
  def update
    @nodes = {}
    @types= @neo.execute_query("MATCH (:OBJECT)-[r:LINK]->(:OBJECT) RETURN COLLECT(distinct r.type)")["data"][0][0]

    @neo.execute_query("MATCH (n:OBJECT) RETURN n")['data'].each do |node|
      id = node[0]['metadata']['id']
      @nodes[id] = node[0]['data']
      @nodes[id]['out_rels'] = {} 
    end
    
    @types.each do |type| 
      @neo.execute_query("MATCH (n:OBJECT)-[rel:LINK {type: '#{type}'}]->(a:OBJECT) RETURN id(n), count(a)")['data'].each do |pair|
        nodes[pair[0]]['out_rels'][type] = pair[1].to_i
      end
    end

    # nodes.each_value do |node|
    #   node['out_rels']['all'] = node['out_rels'].values.reduce(:+).to_i
    # end
    @last_updated = Time.now
  end

  def get_id(url)
    url.gsub(/.*\D/, '').to_i
  end

  def get_out_relationships(id, type)
    @neo.execute_query("START n=node(#{id}) MATCH (n)-[rel:LINK {type: '#{type}'}]->() RETURN rel")['data'].map do |rel|
      {
        source: get_id(rel[0]["start"]),
        target: get_id(rel[0]["end"])
      }
    end
  end

  def get_roots(type)
    query = "MATCH (n:OBJECT) WHERE (n)-[:LINK {type: '#{type}'}]->() AND NOT ()-[:LINK {type: '#{type}'}]->(n) RETURN n"
    @neo.execute_query(query)['data'].map do |node|
      node[0]['metadata']['id']
    end
  end

  def get_levels(type, levels)
    roots = get_roots(type)
    rels = []
    
    rels[0] = roots.map{ |root| get_out_relationships(root, type) }.reduce(:+)
    (0...levels - 1).each do |i|
      rels[i + 1] = []
      rels[i].each do |rel|
        rels[i + 1] += get_out_relationships(rel[:target], type)
        #puts "#{i + 1} #{rels[i + 1].size}"
      end
      #puts "#{i} #{rels[i].size}"
    end
    rels
  end

  def get_links(rels)
    rels.map do |rel|
      {
        source: get_id(rel['start']),
        target: get_id(rel['end']),
        type: rel['data']['type']
      }
    end
  end 

  def get_graph(links, type, nodes = [])
    nodes = Set.new nodes
    links.each do |link|
      nodes.add(link[:source])
      nodes.add(link[:target])
    end

    nodes = nodes.to_a
    nodes.map! do |node|
      {id: node, size: @nodes[node]['out_rels'][type].to_i, type: @nodes[node]['type']}
    end
    
    {nodes: nodes, links: links}
  end
end

configure do
  set :port, 4568
  puts 'configure() starts'
  start_time = Time.now
  
  set :clusters, { 
    'Chebyshev' => Cluster.new('http://graphit.parallel.ru:7474'),
    #'Lomonosov' => Cluster.new('http://stat1.lom.parallel.ru:7474')
  }

  puts "configure() ends in #{Time.now - start_time}s"
end

before do
  @cluster = settings.clusters[params[:cluster]] if params[:cluster]
end

def error_page msg
  erb :error, :locals => {:msg => msg}
end

get '/add-cluster' do
  begin
    settings.clusters[params[:name]] = Cluster.new(params[:url])
  rescue StandardError
    status 400
  end 
end

get '/update' do
  @cluster.update
end

get '/node-info/:id' do
  content_type :json
  @cluster.nodes[params[:id].to_i].to_json
end

get '/node-out-relations/:id' do 
  content_type :json
  type = params[:type]
  
  rels = @cluster.get_out_relationships(params[:id], type)
  @cluster.get_graph(rels, type).to_json
end 

get '/neo' do
  content_type :json
  type = params[:type]
  
  level_number = params[:levels].to_i
  if (level_number == 0)
    roots = @cluster.get_roots(type)
    @cluster.get_graph([], type, roots).to_json
  else
    levels = @cluster.get_levels(type, level_number)
    rels = levels.reduce(:+)
    @cluster.get_graph(rels, type).to_json
  end
end

get '/about' do
  erb :about
end

get '/contact' do
  erb :contact
end

get '/' do
  erb :start
end


not_found do
  error_page '404'
end
